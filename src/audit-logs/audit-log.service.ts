import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';

@Injectable()
export class AuditLogService {
    constructor(
        @InjectModel('AuditLog') private readonly auditLogModel: Model<any>,
        @InjectModel('User') private readonly userModel: Model<any>,
    ) { }

    /**
     * Create a new audit log entry.
     * Called internally by other services or directly via API.
     */
    async create(dto: CreateAuditLogDto) {
        const entry = new this.auditLogModel(dto);
        return entry.save();
    }

    /**
     * Paginated + filterable list of audit logs.
     */
    async findAll(query: {
        page?: number;
        limit?: number;
        actionType?: string;
        actor?: string;
        entityType?: string;
        status?: string;
        startDate?: string;
        endDate?: string;
        search?: string;
    }) {
        const {
            page = 1,
            limit = 20,
            actionType,
            actor,
            entityType,
            status,
            startDate,
            endDate,
            search,
        } = query;

        const filter: any = {};

        if (actionType) filter.actionType = actionType;
        if (actor) filter.actor = { $regex: actor, $options: 'i' };
        if (entityType) filter.entityType = entityType;
        if (status) filter.status = status;

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }

        if (search) {
            filter.$or = [
                { description: { $regex: search, $options: 'i' } },
                { actor: { $regex: search, $options: 'i' } },
                { targetLabel: { $regex: search, $options: 'i' } },
            ];
        }

        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            this.auditLogModel
                .find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
                .exec(),
            this.auditLogModel.countDocuments(filter).exec(),
        ]);

        return {
            data,
            total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(total / limit),
        };
    }

    /**
     * Find a single audit log by ID.
     */
    async findOne(id: string) {
        return this.auditLogModel.findById(id).lean().exec();
    }

    /**
     * Confirm an action (mark as confirmed).
     */
    async confirm(id: string) {
        const log = await this.auditLogModel.findById(id);
        if (!log) throw new Error('Audit log entry not found');
        if (log.status === 'confirmed') throw new Error('Already confirmed');
        if (log.status === 'rolled_back') throw new Error('Cannot confirm a rolled-back action');

        log.status = 'confirmed';
        await log.save();

        // Log the confirmation itself
        await this.create({
            actionType: 'ACTION_CONFIRMED',
            actor: 'System',
            entityType: 'audit',
            targetId: id,
            targetLabel: log.actionType,
            description: `Action "${log.actionType}" was confirmed`,
            status: 'active',
        });

        return log;
    }

    /**
     * Rollback an action — revert entity to previous state where possible.
     */
    async rollback(id: string, actorName: string) {
        const log = await this.auditLogModel.findById(id);
        if (!log) throw new Error('Audit log entry not found');
        if (log.status === 'rolled_back') throw new Error('Already rolled back');
        if (!log.previousState) throw new Error('No previous state to rollback to');

        // Perform the actual rollback based on entity type
        let rollbackSuccess = false;

        try {
            switch (log.entityType) {
                case 'user':
                case 'admin':
                    if (log.targetId && log.previousState) {
                        // Restore user to previous state
                        const updateData: any = {};
                        for (const [key, value] of Object.entries(log.previousState)) {
                            if (['role', 'status', 'username', 'email', 'bio', 'rank', 'xp'].includes(key)) {
                                updateData[key] = value;
                            }
                        }
                        if (Object.keys(updateData).length > 0) {
                            await this.userModel.findByIdAndUpdate(log.targetId, updateData);
                            rollbackSuccess = true;
                        }
                    }
                    break;

                case 'system':
                    // System rollbacks are more complex — just mark as rolled back
                    rollbackSuccess = true;
                    break;

                default:
                    rollbackSuccess = true;
                    break;
            }
        } catch (err) {
            throw new Error(`Rollback failed: ${err.message}`);
        }

        if (rollbackSuccess) {
            log.status = 'rolled_back';
            await log.save();

            // Log the rollback itself
            await this.create({
                actionType: 'ACTION_ROLLED_BACK',
                actor: actorName || 'System',
                entityType: 'audit',
                targetId: id,
                targetLabel: log.actionType,
                previousState: log.newState,
                newState: log.previousState,
                description: `Action "${log.actionType}" was rolled back by ${actorName || 'System'}`,
                status: 'active',
            });
        }

        return log;
    }

    /**
     * Get summary statistics for the dashboard.
     */
    async getStats() {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const [total, last24h, lastWeek, byType, byStatus] = await Promise.all([
            this.auditLogModel.countDocuments().exec(),
            this.auditLogModel.countDocuments({ createdAt: { $gte: oneDayAgo } }).exec(),
            this.auditLogModel.countDocuments({ createdAt: { $gte: oneWeekAgo } }).exec(),
            this.auditLogModel.aggregate([
                { $group: { _id: '$entityType', count: { $sum: 1 } } },
            ]).exec(),
            this.auditLogModel.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } },
            ]).exec(),
        ]);

        return { total, last24h, lastWeek, byType, byStatus };
    }
}
