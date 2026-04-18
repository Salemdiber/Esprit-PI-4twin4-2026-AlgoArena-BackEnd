import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLogController } from './audit-log.controller';
import { AuditLogService } from './audit-log.service';
import { AuditLogSchema } from './schemas/audit-log.schema';
import { UserSchema } from '../user/schemas/user.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: 'AuditLog', schema: AuditLogSchema },
            { name: 'User', schema: UserSchema },
        ]),
    ],
    controllers: [AuditLogController],
    providers: [AuditLogService],
    exports: [AuditLogService],
})
export class AuditLogModule { }
