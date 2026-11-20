import { dropIndexIfExists, ensureIndex } from './helpers.js'
import type { MigrationDefinition } from './types.js'

/** Module 20: Performance Management & HR Analytics indexes. */
export const migration018Performance: MigrationDefinition = {
  id: '018_performance',
  name: 'Create performance management indexes',
  async up({ db }) {
    await ensureIndex(db.collection('rating_scales'), { organizationId: 1, name: 1 })
    await ensureIndex(
      db.collection('performance_templates'),
      { organizationId: 1, name: 1, version: 1 },
      { unique: true },
    )
    await ensureIndex(db.collection('performance_cycles'), {
      organizationId: 1,
      status: 1,
      startDate: -1,
    })
    await ensureIndex(db.collection('performance_cycles'), { organizationId: 1, name: 1 })
    await ensureIndex(
      db.collection('competency_frameworks'),
      { organizationId: 1, name: 1 },
      { unique: true },
    )
    await ensureIndex(
      db.collection('kpi_definitions'),
      { organizationId: 1, name: 1 },
      { unique: true },
    )
    await ensureIndex(db.collection('employee_goals'), {
      organizationId: 1,
      employeeId: 1,
      cycleId: 1,
    })
    await ensureIndex(db.collection('employee_goals'), {
      organizationId: 1,
      status: 1,
      dueDate: 1,
    })
    await ensureIndex(db.collection('goal_progress_history'), {
      organizationId: 1,
      goalId: 1,
      createdAt: -1,
    })
    await ensureIndex(
      db.collection('performance_reviews'),
      { organizationId: 1, cycleId: 1, employeeId: 1 },
      { unique: true },
    )
    await ensureIndex(db.collection('performance_reviews'), {
      organizationId: 1,
      status: 1,
      updatedAt: -1,
    })
    await ensureIndex(db.collection('performance_reviews'), {
      organizationId: 1,
      managerEmployeeId: 1,
      status: 1,
    })
    await ensureIndex(
      db.collection('peer_reviews'),
      { organizationId: 1, reviewId: 1, reviewerEmployeeId: 1 },
      { unique: true },
    )
    await ensureIndex(db.collection('calibration_sessions'), {
      organizationId: 1,
      cycleId: 1,
      createdAt: -1,
    })
    await ensureIndex(db.collection('performance_improvement_plans'), {
      organizationId: 1,
      employeeId: 1,
      status: 1,
    })
    await ensureIndex(db.collection('one_on_ones'), {
      organizationId: 1,
      employeeId: 1,
      scheduledAt: -1,
    })
    await ensureIndex(db.collection('continuous_feedback'), {
      organizationId: 1,
      recipientEmployeeId: 1,
      createdAt: -1,
    })
    await ensureIndex(db.collection('performance_recognitions'), {
      organizationId: 1,
      employeeId: 1,
      createdAt: -1,
    })
    await ensureIndex(db.collection('development_plans'), {
      organizationId: 1,
      employeeId: 1,
      status: 1,
    })
    await ensureIndex(db.collection('training_recommendations'), {
      organizationId: 1,
      employeeId: 1,
      status: 1,
    })
    await ensureIndex(db.collection('succession_plans'), {
      organizationId: 1,
      criticalPositionTitle: 1,
    })
    await ensureIndex(
      db.collection('performance_notification_intents'),
      { organizationId: 1, intentKey: 1 },
      { unique: true },
    )
    await ensureIndex(
      db.collection('performance_outbox_events'),
      { organizationId: 1, eventKey: 1 },
      { unique: true },
    )
  },
  async down({ db }) {
    await dropIndexIfExists(db.collection('rating_scales'), 'organizationId_1_name_1')
    await dropIndexIfExists(
      db.collection('performance_templates'),
      'organizationId_1_name_1_version_1',
    )
    await dropIndexIfExists(db.collection('performance_cycles'), 'organizationId_1_status_1_startDate_-1')
    await dropIndexIfExists(db.collection('employee_goals'), 'organizationId_1_employeeId_1_cycleId_1')
    await dropIndexIfExists(
      db.collection('performance_reviews'),
      'organizationId_1_cycleId_1_employeeId_1',
    )
  },
}
