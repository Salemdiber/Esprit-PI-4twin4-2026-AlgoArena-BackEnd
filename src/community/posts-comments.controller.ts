import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { CommunityService } from './community.service';

@Controller('posts')
export class PostsController {
  constructor(private readonly communityService: CommunityService) {}

  @Get()
  async listPosts() {
    return this.communityService.listPosts();
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async createPost(
    @Body() dto: CreatePostDto,
    @Req() req: { body: unknown },
    @CurrentUser() user: { userId: string; username: string; avatar?: string },
  ) {
    console.log('Saving post:', req.body);
    return this.communityService.createPost(dto, user);
  }
}

@Controller('comments')
export class CommentsController {
  constructor(private readonly communityService: CommunityService) {}

  @Get()
  async listComments() {
    return this.communityService.listComments();
  }

  @Get(':postId')
  async listCommentsByPost(@Param('postId') postId: string) {
    return this.communityService.listComments(postId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async createComment(
    @Body() body: CreateCommentDto & { postId: string },
    @CurrentUser() user: { userId: string; username: string; avatar?: string },
  ) {
    const { postId, ...dto } = body;
    return this.communityService.addCommentAndReturnSaved(postId, dto, user);
  }
}
