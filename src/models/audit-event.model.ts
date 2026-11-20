import { Schema, model } from 'mongoose'
import type { IAuditEvent } from '../interfaces/audit-event.interface.js'

const auditEventSchema = new Schema<IAuditEvent>(
  {
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true, trim: true, maxlength: 80 },
    entityType: { type: String, required: true, trim: true, maxlength: 60 },
    entityId: { type: String, trim: true, maxlength: 64 },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization' },
    branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
    requestId: { type: String, trim: true, maxlength: 128 },
    correlationId: { type: String, trim: true, maxlength: 128 },
    result: { type: String, required: true, enum: ['success', 'failure'] },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, trim: true, maxlength: 64 },
    userAgent: { type: String, trim: true, maxlength: 256 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'audit_events', minimize: false },
)

auditEventSchema.index({ organizationId: 1, createdAt: -1 })
auditEventSchema.index({ actorUserId: 1, createdAt: -1 })
auditEventSchema.index({ action: 1, createdAt: -1 })
auditEventSchema.index({ entityType: 1, entityId: 1 })
auditEventSchema.index({ requestId: 1 }, { sparse: true })

export const AuditEvent = model<IAuditEvent>('AuditEvent', auditEventSchema)
