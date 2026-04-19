import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLogModule } from '../audit-logs/audit-log.module';
import { CommunityController } from './community.controller';
import { CommentsController, PostsController } from './posts-comments.controller';
import { CommunityService } from './community.service';
import { CommunityCommentSchema } from './schemas/community-comment.schema';
import { CommunityPostSchema } from './schemas/community-post.schema';

@Module({
  imports: [
    AuditLogModule,
    MongooseModule.forFeature([
      { name: 'CommunityPost', schema: CommunityPostSchema },
      { name: 'CommunityComment', schema: CommunityCommentSchema },
    ]),
  ],
  controllers: [CommunityController, PostsController, CommentsController],
  providers: [CommunityService],
})
export class CommunityModule { }
