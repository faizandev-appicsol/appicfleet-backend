import {
  PerformanceNotificationIntentModel,
  PerformanceOutboxEventModel,
} from '../../models/performance.model.js'
import type { RequestMeta } from '../../types/access.js'

export async function emitPerformanceNotificationIntent(input: {
  organizationId: string
  kind: string
  intentKey: string
  entityType: string
  entityId: string
  employeeId?: string
  payload?: Record<string, unknown>
  meta?: RequestMeta
}) {
  try {
    await PerformanceNotificationIntentModel.create({
      organizationId: input.organizationId,
      kind: input.kind,
      intentKey: input.intentKey,
      entityType: input.entityType,
      entityId: input.entityId,
      employeeId: input.employeeId,
      payload: {
        ...(input.payload ?? {}),
        requestId: input.meta?.requestId,
      },
      status: 'PENDING',
    })
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: number }).code === 11000
    ) {
      return
    }
    throw error
  }
}

export async function publishPerformanceEvent(input: {
  organizationId: string
  eventKey: string
  eventType: string
  payload?: Record<string, unknown>
}) {
  try {
    await PerformanceOutboxEventModel.create({
      organizationId: input.organizationId,
      eventKey: input.eventKey,
      eventType: input.eventType,
      payload: input.payload ?? {},
      status: 'PENDING',
    })
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: number }).code === 11000
    ) {
      return
    }
    throw error
  }
}
