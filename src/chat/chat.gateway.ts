import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { Server, WebSocket } from 'ws';
import { SendMessageDto } from './dto/send-message.dto';
import { ReactMessageDto } from './dto/react-message.dto';
import { resolveAllowedOrigins } from '../common/server-config';

type SocketUser = { userId: string; username: string; role?: string };
type AuthSocket = WebSocket & { user?: SocketUser; rooms?: Set<string> };

const ALLOWED_REACTIONS = [
  '👍',
  '👎',
  '❤️',
  '🔥',
  '🚀',
  '😂',
  '👏',
  '🤔',
  '💡',
  '✅',
  '😮',
  '🎉',
];

@WebSocketGateway({
  path: '/chat/ws',
  cors: {
    origin: resolveAllowedOrigins(process.env.CORS_ORIGIN),
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly roomMembers = new Map<string, Set<AuthSocket>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatService: ChatService,
  ) {}

  async handleConnection(client: AuthSocket, req: any) {
    try {
      const url = new URL(req.url, 'ws://localhost');
      const tokenFromQuery = url.searchParams.get('token');
      const authHeader = String(req.headers?.authorization || '');
      const tokenFromHeader = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : null;
      const token = tokenFromQuery || tokenFromHeader;
      if (!token) {
        client.close(4001, 'Unauthorized');
        return;
      }
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'defaultJwtSecret',
      });
      client.user = {
        userId: String(payload.sub),
        username: String(payload.username || 'Player'),
        role: payload.role,
      };
      client.rooms = new Set();
    } catch {
      client.close(4001, 'Unauthorized');
    }
  }

  handleDisconnect(client: AuthSocket) {
    for (const roomId of client.rooms || []) {
      this.roomMembers.get(roomId)?.delete(client);
    }
  }

  private emit(client: AuthSocket, event: string, data: unknown) {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify({ event, data }));
    }
  }

  private emitRoom(
    roomId: string,
    event: string,
    data: unknown,
    exclude?: AuthSocket,
  ) {
    const members = this.roomMembers.get(roomId);
    if (!members) return;
    for (const member of members) {
      if (exclude && member === exclude) continue;
      this.emit(member, event, data);
    }
  }

  @SubscribeMessage('joinRoom')
  async joinRoom(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() body: { roomId?: string },
  ) {
    if (!client.user)
      return this.emit(client, 'error', { message: 'Unauthorized' });
    const roomId = body?.roomId || 'general';
    if (!this.roomMembers.has(roomId)) this.roomMembers.set(roomId, new Set());
    this.roomMembers.get(roomId)!.add(client);
    client.rooms?.add(roomId);
    const history = await this.chatService.getHistory(roomId, 1, 50);
    this.emit(client, 'roomJoined', { roomId, ...history });
  }

  @SubscribeMessage('leaveRoom')
  leaveRoom(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() body: { roomId?: string },
  ) {
    const roomId = body?.roomId || 'general';
    this.roomMembers.get(roomId)?.delete(client);
    client.rooms?.delete(roomId);
  }

  @SubscribeMessage('sendMessage')
  async sendMessage(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() body: SendMessageDto,
  ) {
    try {
      if (!client.user)
        return this.emit(client, 'error', { message: 'Unauthorized' });
      const message = await this.chatService.sendMessage(
        client.user.userId,
        client.user.username,
        body.roomId || 'general',
        body.content,
        body.replyTo,
      );
      this.emitRoom(message.roomId || 'general', 'newMessage', message);
    } catch (error: any) {
      this.emit(client, 'error', {
        message: error?.message || 'Failed to send message',
      });
    }
  }

  @SubscribeMessage('addReaction')
  async addReaction(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() body: ReactMessageDto,
  ) {
    if (!client.user)
      return this.emit(client, 'error', { message: 'Unauthorized' });
    if (!ALLOWED_REACTIONS.includes(body.emoji)) {
      return this.emit(client, 'error', { message: 'Unsupported reaction' });
    }
    try {
      const updated = await this.chatService.toggleReaction(
        client.user.userId,
        body.messageId,
        body.emoji,
        true,
      );
      this.emitRoom(updated.roomId || 'general', 'reactionUpdated', {
        messageId: updated._id,
        reactions: updated.reactions,
      });
    } catch (error: any) {
      this.emit(client, 'error', {
        message: error?.message || 'Failed to update reaction',
      });
    }
  }

  @SubscribeMessage('removeReaction')
  async removeReaction(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() body: ReactMessageDto,
  ) {
    if (!client.user)
      return this.emit(client, 'error', { message: 'Unauthorized' });
    try {
      const updated = await this.chatService.toggleReaction(
        client.user.userId,
        body.messageId,
        body.emoji,
        false,
      );
      this.emitRoom(updated.roomId || 'general', 'reactionUpdated', {
        messageId: updated._id,
        reactions: updated.reactions,
      });
    } catch (error: any) {
      this.emit(client, 'error', {
        message: error?.message || 'Failed to update reaction',
      });
    }
  }

  @SubscribeMessage('editMessage')
  async editMessage(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() body: { messageId: string; content: string },
  ) {
    if (!client.user)
      return this.emit(client, 'error', { message: 'Unauthorized' });
    try {
      const updated = await this.chatService.editMessage(
        client.user.userId,
        body.messageId,
        body.content,
      );
      this.emitRoom(updated.roomId || 'general', 'messageEdited', {
        messageId: updated._id,
        content: updated.content,
        editedAt: updated.editedAt,
      });
    } catch (error: any) {
      this.emit(client, 'error', {
        message: error?.message || 'Failed to edit message',
      });
    }
  }

  @SubscribeMessage('deleteMessage')
  async deleteMessage(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() body: { messageId: string },
  ) {
    if (!client.user)
      return this.emit(client, 'error', { message: 'Unauthorized' });
    try {
      const updated = await this.chatService.deleteMessage(
        client.user.userId,
        body.messageId,
      );
      this.emitRoom(updated.roomId || 'general', 'messageDeleted', {
        messageId: updated._id,
      });
    } catch (error: any) {
      this.emit(client, 'error', {
        message: error?.message || 'Failed to delete message',
      });
    }
  }

  @SubscribeMessage('typing')
  typing(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() body: { roomId?: string },
  ) {
    if (!client.user) return;
    const roomId = body?.roomId || 'general';
    this.emitRoom(
      roomId,
      'userTyping',
      { username: client.user.username },
      client,
    );
  }

  @SubscribeMessage('stopTyping')
  stopTyping(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() body: { roomId?: string },
  ) {
    if (!client.user) return;
    const roomId = body?.roomId || 'general';
    this.emitRoom(
      roomId,
      'userStoppedTyping',
      { username: client.user.username },
      client,
    );
  }
}
