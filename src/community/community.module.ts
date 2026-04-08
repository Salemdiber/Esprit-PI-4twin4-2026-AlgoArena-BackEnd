import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLogModule } from '../audit-logs/audit-log.module';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';
import { CommunityPostSchema } from './schemas/community-post.schema';

@Module({
  imports: [
    AuditLogModule,
    MongooseModule.forFeature([{ name: 'CommunityPost', schema: CommunityPostSchema }]),
  ],
  controllers: [CommunityController],
  providers: [CommunityService],
})
export class CommunityModule { }
