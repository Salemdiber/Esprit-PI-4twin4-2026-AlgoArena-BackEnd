import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';
import { CommunityPostSchema } from './schemas/community-post.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'CommunityPost', schema: CommunityPostSchema }]),
  ],
  controllers: [CommunityController],
  providers: [CommunityService],
})
export class CommunityModule { }
