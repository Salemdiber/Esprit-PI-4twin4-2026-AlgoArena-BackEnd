import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';
import {
  SupportRequest,
  SupportRequestSchema,
} from './schemas/support-request.schema';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SupportRequest.name, schema: SupportRequestSchema },
    ]),
    UserModule,
  ],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
