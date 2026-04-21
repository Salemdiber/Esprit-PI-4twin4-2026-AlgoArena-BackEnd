import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, WebSocket } from 'ws';

type SocketUser = { userId: string; username: string; role?: string };
type AuthSocket = WebSocket & { user?: SocketUser; rooms?: Set<string> };

@WebSocketGateway({
  path: '/battles/ws',
  cors: {
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
      .split(',')
      .map((v) => v.trim()),
    credentials: true,
  },
})
export class BattleGateway implements OnGatewayConnection, OnGatewayDisconnect {
  server: Server;

  private readonly roomMembers = new Map<string, Set<AuthSocket>>();

  constructor(private readonly jwtService: JwtService) {}

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

  @SubscribeMessage('watchBattle')
  watchBattle(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() body: { battleId?: string },
  ) {
    if (!client.user)
      return this.emit(client, 'error', { message: 'Unauthorized' });
    const battleId = String(body?.battleId || '').trim();
    if (!battleId)
      return this.emit(client, 'error', { message: 'battleId is required' });

    const roomId = `battle:${battleId}`;
    if (!this.roomMembers.has(roomId)) this.roomMembers.set(roomId, new Set());
    this.roomMembers.get(roomId)!.add(client);
    client.rooms?.add(roomId);
    this.emit(client, 'battleWatched', { battleId });
  }

  @SubscribeMessage('unwatchBattle')
  unwatchBattle(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() body: { battleId?: string },
  ) {
    const battleId = String(body?.battleId || '').trim();
    if (!battleId) return;
    const roomId = `battle:${battleId}`;
    this.roomMembers.get(roomId)?.delete(client);
    client.rooms?.delete(roomId);
  }

  @SubscribeMessage('battleRoundResult')
  battleRoundResult(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody()
    body: { battleId?: string; roundIndex?: number; result?: unknown },
  ) {
    if (!client.user)
      return this.emit(client, 'error', { message: 'Unauthorized' });

    const battleId = String(body?.battleId || '').trim();
    if (!battleId)
      return this.emit(client, 'error', { message: 'battleId is required' });

    const roomId = `battle:${battleId}`;
    this.emitRoom(roomId, 'battleRoundResult', {
      battleId,
      roundIndex: Number(body?.roundIndex || 0),
      userId: client.user.userId,
      username: client.user.username,
      result: body?.result || null,
      timestamp: new Date().toISOString(),
    });
  }

  emitBattleJoined(payload: {
    battleId: string;
    userId: string;
    opponentId: string | null;
    battleStatus: string;
  }) {
    const roomId = `battle:${payload.battleId}`;
    this.emitRoom(roomId, 'battleJoined', {
      battleId: payload.battleId,
      userId: payload.userId,
      opponentId: payload.opponentId,
      battleStatus: payload.battleStatus,
      timestamp: new Date().toISOString(),
    });
  }

  emitBattleRoundResult(payload: {
    battleId: string;
    roundIndex: number;
    userId: string;
    result: Record<string, any>;
    timestamp: string;
  }) {
    const roomId = `battle:${payload.battleId}`;
    this.emitRoom(roomId, 'battleRoundResult', payload);
  }
}
