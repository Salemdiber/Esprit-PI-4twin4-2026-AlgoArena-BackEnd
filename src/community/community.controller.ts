import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CommunityService } from './community.service';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { Request } from 'express';

const communityUploadDir = join(process.cwd(), 'uploads', 'community');

const ensureUploadDir = () => {
  if (!existsSync(communityUploadDir)) {
    mkdirSync(communityUploadDir, { recursive: true });
  }
};

@Controller('community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) { }

  @UseGuards(JwtAuthGuard)
  @Post('uploads')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          ensureUploadDir();
          cb(null, communityUploadDir);
        },
        filename: (_req, file, cb) => {
          const safeExt = extname(file.originalname || '').toLowerCase();
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `community-${unique}${safeExt}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        const isImage = file.mimetype?.startsWith('image/');
        const isVideo = file.mimetype?.startsWith('video/');
        if (!isImage && !isVideo) {
          return cb(new BadRequestException('Only image or video files are allowed') as any, false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadMedia(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const host = req.get('host');
    const protocol = req.protocol;
    const relativePath = `/uploads/community/${file.filename}`;

    return {
      url: relativePath,
      absoluteUrl: `${protocol}://${host}${relativePath}`,
      mimetype: file.mimetype,
      size: file.size,
    };
  }

  @Get('posts')
  async listPosts() {
    return this.communityService.listPosts();
  }

  @UseGuards(JwtAuthGuard)
  @Post('posts')
  async createPost(
    @Body() dto: CreatePostDto,
    @CurrentUser() user: { userId: string; username: string; avatar?: string; role?: string },
  ) {
    return this.communityService.createPost(dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('posts/:postId/comments')
  async addComment(
    @Param('postId') postId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: { userId: string; username: string; avatar?: string; role?: string },
  ) {
    return this.communityService.addComment(postId, dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('posts/:postId')
  async updatePost(
    @Param('postId') postId: string,
    @Body() dto: UpdatePostDto,
    @CurrentUser() user: { userId: string; username: string; role?: string },
  ) {
    return this.communityService.updatePost(postId, dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('posts/:postId/comments/:commentId')
  async updateComment(
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: { userId: string; username: string; role?: string },
  ) {
    return this.communityService.updateComment(postId, commentId, dto, user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('posts/:postId')
  async deletePost(
    @Param('postId') postId: string,
    @CurrentUser() user: { userId: string; role?: string },
  ) {
    return this.communityService.deletePost(postId, user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('posts/:postId/comments/:commentId')
  async deleteComment(
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: { userId: string; role?: string },
  ) {
    return this.communityService.deleteComment(postId, commentId, user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('posts/:postId/solve')
  async toggleSolved(
    @Param('postId') postId: string,
    @Body() dto: { solved?: boolean },
    @CurrentUser() user: { userId: string; username: string; role?: string },
  ) {
    return this.communityService.updatePost(postId, { solved: Boolean(dto?.solved) }, user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('posts/:postId/pin')
  async togglePostPin(
    @Param('postId') postId: string,
    @Body() dto: { pinned?: boolean },
    @CurrentUser() user: { userId: string; username: string; role?: string },
  ) {
    return this.communityService.updatePost(postId, { pinned: Boolean(dto?.pinned) }, user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('posts/:postId/comments/:commentId/pin')
  async toggleCommentPin(
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
    @Body() dto: { pinned?: boolean },
    @CurrentUser() user: { userId: string; username: string; role?: string },
  ) {
    return this.communityService.updateComment(postId, commentId, { pinned: Boolean(dto?.pinned) }, user);
  }
}
