import { Schema } from 'mongoose';

export const AuditLogSchema = new Schema(
    {
        // What happened
        actionType: {
            type: String,
            required: true,
            enum: [
                // User events
                'USER_REGISTERED',
                'USER_BANNED',
                'USER_UNBANNED',
                'USER_DELETED',
                'USER_DISABLED',
                'USER_REACTIVATED',
                'USER_ROLE_CHANGED',
                'PASSWORD_RESET',
                // Admin events
                'ADMIN_ADDED',
                'ADMIN_REMOVED',
                'ADMIN_ROLE_UPDATED',
                'PERMISSION_CHANGED',
                // Challenge events
                'CHALLENGE_CREATED',
                'CHALLENGE_PUBLISHED',
                'CHALLENGE_UNPUBLISHED',
                'CHALLENGE_EDITED',
                'CHALLENGE_DELETED',
                'CHALLENGE_STARTED',
                'CHALLENGE_SUBMITTED',
                'CHALLENGE_SOLVED',
                'DIFFICULTY_CHANGED',
                'TAGS_UPDATED',
                // System events
                'SYSTEM_CONFIG_UPDATED',
                'SETTINGS_UPDATED',
                'FEATURE_FLAG_CHANGED',
                'SECURITY_SETTINGS_CHANGED',
                '2FA_ENFORCEMENT_UPDATED',
                // Audit meta-events
                'ACTION_CONFIRMED',
                'ACTION_ROLLED_BACK',
            ],
            index: true,
        },

        // Who did it
        actor: {
            type: String,
            required: true,
            index: true,
        },
        actorId: {
            type: String,
            default: null,
        },

        // What was affected
        entityType: {
            type: String,
            required: true,
            enum: ['user', 'admin', 'challenge', 'system', 'audit'],
            index: true,
        },
        targetId: {
            type: String,
            default: null,
        },
        targetLabel: {
            type: String,
            default: null,
        },

        // State tracking for rollback
        previousState: {
            type: Schema.Types.Mixed,
            default: null,
        },
        newState: {
            type: Schema.Types.Mixed,
            default: null,
        },

        // Human-readable description
        description: {
            type: String,
            required: true,
        },

        // Status lifecycle
        status: {
            type: String,
            enum: ['active', 'confirmed', 'rolled_back', 'pending'],
            default: 'active',
            index: true,
        },

        // Optional metadata
        metadata: {
            type: Schema.Types.Mixed,
            default: {},
        },
    },
    {
        timestamps: true,
    },
);

// Compound index for efficient querying
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ actionType: 1, createdAt: -1 });
AuditLogSchema.index({ entityType: 1, createdAt: -1 });
