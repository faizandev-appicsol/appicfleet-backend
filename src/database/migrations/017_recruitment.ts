import { dropIndexIfExists, ensureIndex } from './helpers.js'
import type { MigrationDefinition } from './types.js'

/** Module 19: Recruitment & Employee Onboarding indexes. */
export const migration017Recruitment: MigrationDefinition = {
  id: '017_recruitment',
  name: 'Create recruitment and onboarding indexes',
  async up({ db }) {
    await ensureIndex(
      db.collection('job_requisitions'),
      { organizationId: 1, requisitionNumber: 1 },
      { unique: true },
    )
    await ensureIndex(db.collection('job_requisitions'), {
      organizationId: 1,
      status: 1,
      createdAt: -1,
    })
    await ensureIndex(db.collection('job_requisitions'), {
      organizationId: 1,
      branchId: 1,
      status: 1,
    })

    await ensureIndex(db.collection('job_postings'), {
      organizationId: 1,
      status: 1,
      publishedAt: -1,
    })
    await ensureIndex(db.collection('job_postings'), { organizationId: 1, requisitionId: 1 })

    await ensureIndex(
      db.collection('recruitment_stages'),
      { organizationId: 1, code: 1 },
      { unique: true },
    )
    await ensureIndex(db.collection('recruitment_stages'), { organizationId: 1, sortOrder: 1 })

    await ensureIndex(db.collection('candidates'), { organizationId: 1, email: 1 })
    await ensureIndex(db.collection('candidates'), { organizationId: 1, phone: 1 }, { sparse: true })
    await ensureIndex(db.collection('candidates'), {
      organizationId: 1,
      status: 1,
      lastName: 1,
      firstName: 1,
    })

    await ensureIndex(db.collection('candidate_documents'), {
      organizationId: 1,
      candidateId: 1,
      createdAt: -1,
    })

    await ensureIndex(
      db.collection('applications'),
      { organizationId: 1, candidateId: 1, postingId: 1 },
      { unique: true },
    )
    await ensureIndex(db.collection('applications'), {
      organizationId: 1,
      status: 1,
      stageCode: 1,
      appliedAt: -1,
    })
    await ensureIndex(db.collection('applications'), {
      organizationId: 1,
      requisitionId: 1,
      status: 1,
    })
    await ensureIndex(
      db.collection('applications'),
      { organizationId: 1, idempotencyKey: 1 },
      { unique: true, sparse: true },
    )

    await ensureIndex(db.collection('application_stage_history'), {
      organizationId: 1,
      applicationId: 1,
      createdAt: -1,
    })

    await ensureIndex(db.collection('interviews'), {
      organizationId: 1,
      scheduledStart: 1,
      status: 1,
    })
    await ensureIndex(db.collection('interviews'), {
      organizationId: 1,
      applicationId: 1,
      scheduledStart: -1,
    })
    await ensureIndex(db.collection('interviews'), {
      organizationId: 1,
      candidateId: 1,
      scheduledStart: -1,
    })

    await ensureIndex(
      db.collection('interview_feedback'),
      { organizationId: 1, interviewId: 1, interviewerUserId: 1 },
      { unique: true },
    )

    await ensureIndex(
      db.collection('evaluation_criteria'),
      { organizationId: 1, code: 1 },
      { unique: true },
    )
    await ensureIndex(db.collection('candidate_evaluations'), {
      organizationId: 1,
      applicationId: 1,
      criterionId: 1,
    })

    await ensureIndex(db.collection('offers'), { organizationId: 1, applicationId: 1, status: 1 })
    await ensureIndex(db.collection('offers'), {
      organizationId: 1,
      candidateId: 1,
      createdAt: -1,
    })
    await ensureIndex(
      db.collection('offers'),
      { organizationId: 1, idempotencyKey: 1 },
      { unique: true, sparse: true },
    )

    await ensureIndex(db.collection('offer_approvals'), {
      organizationId: 1,
      offerId: 1,
      createdAt: -1,
    })

    await ensureIndex(
      db.collection('onboarding_templates'),
      { organizationId: 1, code: 1 },
      { unique: true },
    )

    await ensureIndex(
      db.collection('employee_onboardings'),
      { organizationId: 1, employeeId: 1 },
      { unique: true },
    )
    await ensureIndex(db.collection('employee_onboardings'), {
      organizationId: 1,
      status: 1,
      startDate: -1,
    })
    await ensureIndex(
      db.collection('employee_onboardings'),
      { organizationId: 1, idempotencyKey: 1 },
      { unique: true, sparse: true },
    )

    await ensureIndex(db.collection('onboarding_tasks'), {
      organizationId: 1,
      onboardingId: 1,
      sortOrder: 1,
    })
    await ensureIndex(db.collection('onboarding_tasks'), {
      organizationId: 1,
      status: 1,
      dueDate: 1,
    })

    await ensureIndex(db.collection('candidate_activities'), {
      organizationId: 1,
      candidateId: 1,
      createdAt: -1,
    })

    await ensureIndex(db.collection('candidate_invitations'), { tokenHash: 1 }, { unique: true })
    await ensureIndex(db.collection('candidate_invitations'), {
      organizationId: 1,
      candidateId: 1,
      createdAt: -1,
    })

    await ensureIndex(
      db.collection('recruitment_notification_intents'),
      { organizationId: 1, intentKey: 1 },
      { unique: true },
    )
    await ensureIndex(
      db.collection('recruitment_outbox_events'),
      { organizationId: 1, eventKey: 1 },
      { unique: true },
    )
    await ensureIndex(
      db.collection('recruitment_counters'),
      { organizationId: 1, name: 1 },
      { unique: true },
    )
  },
  async down({ db }) {
    await dropIndexIfExists(db.collection('job_requisitions'), [
      'organizationId_1_requisitionNumber_1',
    ])
    await dropIndexIfExists(db.collection('candidates'), ['organizationId_1_email_1'])
    await dropIndexIfExists(db.collection('applications'), [
      'organizationId_1_candidateId_1_postingId_1',
    ])
    await dropIndexIfExists(db.collection('offers'), ['organizationId_1_idempotencyKey_1'])
    await dropIndexIfExists(db.collection('employee_onboardings'), [
      'organizationId_1_employeeId_1',
    ])
    await dropIndexIfExists(db.collection('candidate_invitations'), ['tokenHash_1'])
    await dropIndexIfExists(db.collection('recruitment_notification_intents'), [
      'organizationId_1_intentKey_1',
    ])
    await dropIndexIfExists(db.collection('recruitment_outbox_events'), [
      'organizationId_1_eventKey_1',
    ])
  },
}
