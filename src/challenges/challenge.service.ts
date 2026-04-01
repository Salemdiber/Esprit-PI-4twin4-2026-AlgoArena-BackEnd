import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Challenge, ChallengeDocument } from './schemas/challenge.schema';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import { AuditLogService } from '../audit-logs/audit-log.service';

@Injectable()
export class ChallengeService {
    constructor(
        @InjectModel(Challenge.name) private readonly challengeModel: Model<ChallengeDocument>,
        private readonly auditLogService: AuditLogService,
    ) { }

    async create(dto: CreateChallengeDto, createdBy?: string, actorName?: string): Promise<ChallengeDocument> {
        const challenge = new this.challengeModel({
            ...dto,
            createdBy,
            acceptanceRate: 0,
            solvedCount: 0,
        });
        const saved = await challenge.save();

        // Audit log: challenge created
        await this.auditLogService.create({
            actionType: 'CHALLENGE_CREATED',
            actor: actorName || 'Admin',
            actorId: createdBy,
            entityType: 'challenge',
            targetId: (saved as any)._id?.toString(),
            targetLabel: saved.title,
            newState: {
                title: saved.title,
                difficulty: saved.difficulty,
                status: saved.status,
                aiGenerated: saved.aiGenerated,
                tags: saved.tags,
            },
            description: `${actorName || 'Admin'} created challenge "${saved.title}"${saved.aiGenerated ? ' (AI-generated)' : ''}`,
            status: 'active',
        });

        // If created directly as published, also log the publish event
        if (saved.status === 'published') {
            await this.auditLogService.create({
                actionType: 'CHALLENGE_PUBLISHED',
                actor: actorName || 'Admin',
                actorId: createdBy,
                entityType: 'challenge',
                targetId: (saved as any)._id?.toString(),
                targetLabel: saved.title,
                previousState: { status: 'draft' },
                newState: { status: 'published' },
                description: `${actorName || 'Admin'} published challenge "${saved.title}"`,
                status: 'active',
            });
        }

        return saved;
    }

    async findAll(query?: {
        status?: string;
        difficulty?: string;
        tag?: string;
        search?: string;
        sort?: string;
        page?: number;
        limit?: number;
    }): Promise<{ challenges: ChallengeDocument[]; total: number; page: number; pages: number }> {
        const filter: any = {};

        if (query?.status) filter.status = query.status;
        if (query?.difficulty) filter.difficulty = query.difficulty;
        if (query?.tag) filter.tags = { $in: [query.tag] };
        if (query?.search) {
            filter.$or = [
                { title: { $regex: query.search, $options: 'i' } },
                { tags: { $regex: query.search, $options: 'i' } },
                { description: { $regex: query.search, $options: 'i' } },
            ];
        }

        const page = Math.max(1, query?.page || 1);
        const limit = Math.min(50, Math.max(1, query?.limit || 20));
        const skip = (page - 1) * limit;

        // Sort
        let sortObj: any = { createdAt: -1 }; // default: newest
        switch (query?.sort) {
            case 'difficulty':
                sortObj = { difficulty: 1 };
                break;
            case 'xp':
                sortObj = { xpReward: -1 };
                break;
            case 'acceptance':
                sortObj = { acceptanceRate: -1 };
                break;
            case 'popularity':
                sortObj = { solvedCount: -1 };
                break;
            case 'oldest':
                sortObj = { createdAt: 1 };
                break;
        }

        const [challenges, total] = await Promise.all([
            this.challengeModel.find(filter).sort(sortObj).skip(skip).limit(limit).lean().exec(),
            this.challengeModel.countDocuments(filter).exec(),
        ]);

        return {
            challenges: challenges as ChallengeDocument[],
            total,
            page,
            pages: Math.ceil(total / limit),
        };
    }

    async findById(id: string): Promise<ChallengeDocument> {
        const challenge = await this.challengeModel.findById(id).lean().exec();
        if (!challenge) throw new NotFoundException('Challenge not found');
        return challenge as ChallengeDocument;
    }

    async update(id: string, dto: Partial<CreateChallengeDto>, actorId?: string, actorName?: string): Promise<ChallengeDocument> {
        const existing = await this.challengeModel.findById(id).lean().exec();
        if (!existing) throw new NotFoundException('Challenge not found');

        const updated = await this.challengeModel
            .findByIdAndUpdate(id, dto, { new: true })
            .lean()
            .exec();
        if (!updated) throw new NotFoundException('Challenge not found');

        // Build state diff for audit
        const changedFields: Record<string, any> = {};
        const prevFields: Record<string, any> = {};
        for (const key of Object.keys(dto)) {
            if (JSON.stringify((existing as any)[key]) !== JSON.stringify((updated as any)[key])) {
                prevFields[key] = (existing as any)[key];
                changedFields[key] = (updated as any)[key];
            }
        }

        if (Object.keys(changedFields).length > 0) {
            await this.auditLogService.create({
                actionType: 'CHALLENGE_EDITED',
                actor: actorName || 'Admin',
                actorId: actorId,
                entityType: 'challenge',
                targetId: id,
                targetLabel: (updated as any).title,
                previousState: prevFields,
                newState: changedFields,
                description: `${actorName || 'Admin'} edited challenge "${(updated as any).title}" (changed: ${Object.keys(changedFields).join(', ')})`,
                status: 'active',
            });
        }

        return updated as ChallengeDocument;
    }

    async publish(id: string, actorId?: string, actorName?: string): Promise<ChallengeDocument> {
        const existing = await this.challengeModel.findById(id).lean().exec();
        if (!existing) throw new NotFoundException('Challenge not found');

        const updated = await this.challengeModel
            .findByIdAndUpdate(id, { status: 'published' }, { new: true })
            .lean()
            .exec();

        await this.auditLogService.create({
            actionType: 'CHALLENGE_PUBLISHED',
            actor: actorName || 'Admin',
            actorId: actorId,
            entityType: 'challenge',
            targetId: id,
            targetLabel: (existing as any).title,
            previousState: { status: (existing as any).status },
            newState: { status: 'published' },
            description: `${actorName || 'Admin'} published challenge "${(existing as any).title}"`,
            status: 'active',
        });

        return updated as ChallengeDocument;
    }

    async unpublish(id: string, actorId?: string, actorName?: string): Promise<ChallengeDocument> {
        const existing = await this.challengeModel.findById(id).lean().exec();
        if (!existing) throw new NotFoundException('Challenge not found');

        const updated = await this.challengeModel
            .findByIdAndUpdate(id, { status: 'draft' }, { new: true })
            .lean()
            .exec();

        await this.auditLogService.create({
            actionType: 'CHALLENGE_UNPUBLISHED',
            actor: actorName || 'Admin',
            actorId: actorId,
            entityType: 'challenge',
            targetId: id,
            targetLabel: (existing as any).title,
            previousState: { status: (existing as any).status },
            newState: { status: 'draft' },
            description: `${actorName || 'Admin'} unpublished challenge "${(existing as any).title}"`,
            status: 'active',
        });

        return updated as ChallengeDocument;
    }

    async remove(id: string, actorId?: string, actorName?: string): Promise<{ deleted: boolean }> {
        const existing = await this.challengeModel.findById(id).lean().exec();
        if (!existing) throw new NotFoundException('Challenge not found');

        await this.challengeModel.findByIdAndDelete(id).exec();

        await this.auditLogService.create({
            actionType: 'CHALLENGE_DELETED',
            actor: actorName || 'Admin',
            actorId: actorId,
            entityType: 'challenge',
            targetId: id,
            targetLabel: (existing as any).title,
            previousState: {
                title: (existing as any).title,
                difficulty: (existing as any).difficulty,
                status: (existing as any).status,
                tags: (existing as any).tags,
            },
            description: `${actorName || 'Admin'} deleted challenge "${(existing as any).title}"`,
            status: 'active',
        });

        return { deleted: true };
    }

    // Public endpoint: only published challenges
    async findPublished(query?: {
        difficulty?: string;
        tag?: string;
        search?: string;
        sort?: string;
    }): Promise<ChallengeDocument[]> {
        const filter: any = { status: 'published' };

        if (query?.difficulty) filter.difficulty = query.difficulty;
        if (query?.tag) filter.tags = { $in: [query.tag] };
        if (query?.search) {
            filter.$or = [
                { title: { $regex: query.search, $options: 'i' } },
                { tags: { $regex: query.search, $options: 'i' } },
            ];
        }

        let sortObj: any = { createdAt: -1 };
        switch (query?.sort) {
            case 'difficulty':
                sortObj = { difficulty: 1 };
                break;
            case 'xp':
                sortObj = { xpReward: -1 };
                break;
            case 'acceptance':
                sortObj = { acceptanceRate: -1 };
                break;
            case 'popularity':
                sortObj = { solvedCount: -1 };
                break;
        }

        return this.challengeModel.find(filter).sort(sortObj).lean().exec() as Promise<ChallengeDocument[]>;
    }

    async incrementSolvedCount(id: string): Promise<void> {
        await this.challengeModel.updateOne({ _id: id }, { $inc: { solvedCount: 1 } }).exec();
    }
}
