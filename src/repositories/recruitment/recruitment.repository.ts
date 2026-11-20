import type { FilterQuery } from 'mongoose'
import {
  ApplicationModel,
  ApplicationStageHistoryModel,
  CandidateActivityModel,
  CandidateDocumentModel,
  CandidateInvitationModel,
  CandidateModel,
  EmployeeOnboardingModel,
  InterviewFeedbackModel,
  InterviewModel,
  JobPostingModel,
  JobRequisitionModel,
  OfferApprovalModel,
  OfferModel,
  OnboardingTaskModel,
  OnboardingTemplateModel,
  RecruitmentCounterModel,
  RecruitmentNotificationIntentModel,
  RecruitmentOutboxEventModel,
  RecruitmentStageModel,
} from '../../models/recruitment.model.js'
import { toObjectId } from '../object-id.js'

type LeanDoc = Record<string, unknown> & { _id: { toString(): string } }

function sid(value: unknown): string {
  return String(value)
}

function oid(value?: string | null) {
  return value ? toObjectId(value) : undefined
}

function isDuplicateKey(error: unknown): boolean {
  return Boolean(
    error && typeof error === 'object' && 'code' in error && (error as { code?: number }).code === 11000,
  )
}

function mapBase(doc: LeanDoc) {
  return {
    id: sid(doc._id),
    organizationId: sid(doc.organizationId),
    createdAt: doc.createdAt as Date,
    updatedAt: doc.updatedAt as Date,
  }
}

export type JobRequisitionRecord = ReturnType<typeof mapRequisition>
export type JobPostingRecord = ReturnType<typeof mapPosting>
export type CandidateRecord = ReturnType<typeof mapCandidate>
export type ApplicationRecord = ReturnType<typeof mapApplication>
export type InterviewRecord = ReturnType<typeof mapInterview>
export type OfferRecord = ReturnType<typeof mapOffer>
export type OnboardingRecord = ReturnType<typeof mapOnboarding>
export type OnboardingTaskRecord = ReturnType<typeof mapOnboardingTask>
export type OnboardingTemplateRecord = ReturnType<typeof mapTemplate>
export type RecruitmentStageRecord = ReturnType<typeof mapStage>

function mapRequisition(doc: LeanDoc) {
  return {
    ...mapBase(doc),
    legalEntityId: sid(doc.legalEntityId),
    branchId: sid(doc.branchId),
    requisitionNumber: sid(doc.requisitionNumber),
    jobTitle: sid(doc.jobTitle),
    positionId: doc.positionId ? sid(doc.positionId) : undefined,
    departmentId: doc.departmentId ? sid(doc.departmentId) : undefined,
    hiringManagerEmployeeId: doc.hiringManagerEmployeeId
      ? sid(doc.hiringManagerEmployeeId)
      : undefined,
    recruiterUserId: doc.recruiterUserId ? sid(doc.recruiterUserId) : undefined,
    openings: Number(doc.openings ?? 1),
    employmentType: sid(doc.employmentType),
    targetStartDate: doc.targetStartDate as Date | undefined,
    salaryMin: doc.salaryMin ? sid(doc.salaryMin) : undefined,
    salaryMax: doc.salaryMax ? sid(doc.salaryMax) : undefined,
    currency: doc.currency ? sid(doc.currency) : undefined,
    jobDescription: doc.jobDescription ? sid(doc.jobDescription) : undefined,
    requirements: doc.requirements ? sid(doc.requirements) : undefined,
    responsibilities: doc.responsibilities ? sid(doc.responsibilities) : undefined,
    status: sid(doc.status),
    priority: sid(doc.priority),
    reasonForHiring: doc.reasonForHiring ? sid(doc.reasonForHiring) : undefined,
    approvedBy: doc.approvedBy ? sid(doc.approvedBy) : undefined,
    approvedAt: doc.approvedAt as Date | undefined,
    approvalNotes: doc.approvalNotes ? sid(doc.approvalNotes) : undefined,
    createdBy: sid(doc.createdBy),
  }
}

function mapPosting(doc: LeanDoc) {
  return {
    ...mapBase(doc),
    legalEntityId: sid(doc.legalEntityId),
    branchId: sid(doc.branchId),
    requisitionId: sid(doc.requisitionId),
    title: sid(doc.title),
    description: doc.description ? sid(doc.description) : undefined,
    requirements: doc.requirements ? sid(doc.requirements) : undefined,
    responsibilities: doc.responsibilities ? sid(doc.responsibilities) : undefined,
    location: doc.location ? sid(doc.location) : undefined,
    employmentType: doc.employmentType ? sid(doc.employmentType) : undefined,
    departmentId: doc.departmentId ? sid(doc.departmentId) : undefined,
    positionId: doc.positionId ? sid(doc.positionId) : undefined,
    salaryMin: doc.salaryMin ? sid(doc.salaryMin) : undefined,
    salaryMax: doc.salaryMax ? sid(doc.salaryMax) : undefined,
    currency: doc.currency ? sid(doc.currency) : undefined,
    applicationDeadline: doc.applicationDeadline as Date | undefined,
    status: sid(doc.status),
    visibility: sid(doc.visibility),
    publishedAt: doc.publishedAt as Date | undefined,
    closedAt: doc.closedAt as Date | undefined,
    createdBy: sid(doc.createdBy),
  }
}

function mapCandidate(doc: LeanDoc) {
  return {
    ...mapBase(doc),
    legalEntityId: doc.legalEntityId ? sid(doc.legalEntityId) : undefined,
    branchId: doc.branchId ? sid(doc.branchId) : undefined,
    firstName: sid(doc.firstName),
    middleName: doc.middleName ? sid(doc.middleName) : undefined,
    lastName: sid(doc.lastName),
    preferredName: doc.preferredName ? sid(doc.preferredName) : undefined,
    email: sid(doc.email),
    phone: doc.phone ? sid(doc.phone) : undefined,
    location: doc.location ? sid(doc.location) : undefined,
    country: doc.country ? sid(doc.country) : undefined,
    currentEmployer: doc.currentEmployer ? sid(doc.currentEmployer) : undefined,
    currentTitle: doc.currentTitle ? sid(doc.currentTitle) : undefined,
    yearsOfExperience: doc.yearsOfExperience != null ? Number(doc.yearsOfExperience) : undefined,
    skills: (doc.skills as string[]) ?? [],
    qualifications: doc.qualifications ? sid(doc.qualifications) : undefined,
    certifications: doc.certifications ? sid(doc.certifications) : undefined,
    languages: (doc.languages as string[]) ?? [],
    resumeStorageKey: doc.resumeStorageKey ? sid(doc.resumeStorageKey) : undefined,
    source: sid(doc.source),
    recruiterUserId: doc.recruiterUserId ? sid(doc.recruiterUserId) : undefined,
    status: sid(doc.status),
    notes: doc.notes ? sid(doc.notes) : undefined,
    employeeId: doc.employeeId ? sid(doc.employeeId) : undefined,
    hiredAt: doc.hiredAt as Date | undefined,
    createdBy: sid(doc.createdBy),
  }
}

function mapApplication(doc: LeanDoc) {
  return {
    ...mapBase(doc),
    legalEntityId: sid(doc.legalEntityId),
    branchId: sid(doc.branchId),
    candidateId: sid(doc.candidateId),
    postingId: sid(doc.postingId),
    requisitionId: sid(doc.requisitionId),
    appliedAt: doc.appliedAt as Date,
    stageCode: sid(doc.stageCode),
    status: sid(doc.status),
    source: doc.source ? sid(doc.source) : undefined,
    recruiterUserId: doc.recruiterUserId ? sid(doc.recruiterUserId) : undefined,
    notes: doc.notes ? sid(doc.notes) : undefined,
    createdBy: sid(doc.createdBy),
  }
}

function mapInterview(doc: LeanDoc) {
  return {
    ...mapBase(doc),
    legalEntityId: sid(doc.legalEntityId),
    branchId: sid(doc.branchId),
    candidateId: sid(doc.candidateId),
    applicationId: sid(doc.applicationId),
    interviewType: sid(doc.interviewType),
    interviewerUserIds: ((doc.interviewerUserIds as unknown[]) ?? []).map((id) => sid(id)),
    scheduledStart: doc.scheduledStart as Date,
    scheduledEnd: doc.scheduledEnd as Date,
    timezone: sid(doc.timezone),
    location: doc.location ? sid(doc.location) : undefined,
    meetingLink: doc.meetingLink ? sid(doc.meetingLink) : undefined,
    status: sid(doc.status),
    notes: doc.notes ? sid(doc.notes) : undefined,
    createdBy: sid(doc.createdBy),
  }
}

function mapOffer(doc: LeanDoc) {
  return {
    ...mapBase(doc),
    legalEntityId: sid(doc.legalEntityId),
    branchId: sid(doc.branchId),
    candidateId: sid(doc.candidateId),
    applicationId: sid(doc.applicationId),
    requisitionId: sid(doc.requisitionId),
    positionId: doc.positionId ? sid(doc.positionId) : undefined,
    departmentId: doc.departmentId ? sid(doc.departmentId) : undefined,
    proposedStartDate: doc.proposedStartDate as Date,
    employmentType: sid(doc.employmentType),
    baseSalary: sid(doc.baseSalary),
    allowancesSummary: doc.allowancesSummary ? sid(doc.allowancesSummary) : undefined,
    benefitsSummary: doc.benefitsSummary ? sid(doc.benefitsSummary) : undefined,
    currency: sid(doc.currency),
    compensationStructureId: doc.compensationStructureId
      ? sid(doc.compensationStructureId)
      : undefined,
    expiresAt: doc.expiresAt as Date,
    status: sid(doc.status),
    notes: doc.notes ? sid(doc.notes) : undefined,
    offerLetterStorageKey: doc.offerLetterStorageKey ? sid(doc.offerLetterStorageKey) : undefined,
    approvedBy: doc.approvedBy ? sid(doc.approvedBy) : undefined,
    approvedAt: doc.approvedAt as Date | undefined,
    sentAt: doc.sentAt as Date | undefined,
    respondedAt: doc.respondedAt as Date | undefined,
    responseNotes: doc.responseNotes ? sid(doc.responseNotes) : undefined,
    createdBy: sid(doc.createdBy),
  }
}

function mapOnboarding(doc: LeanDoc) {
  return {
    ...mapBase(doc),
    legalEntityId: sid(doc.legalEntityId),
    branchId: sid(doc.branchId),
    employeeId: sid(doc.employeeId),
    candidateId: doc.candidateId ? sid(doc.candidateId) : undefined,
    offerId: doc.offerId ? sid(doc.offerId) : undefined,
    applicationId: doc.applicationId ? sid(doc.applicationId) : undefined,
    templateId: doc.templateId ? sid(doc.templateId) : undefined,
    startDate: doc.startDate as Date,
    status: sid(doc.status),
    assignedHrUserId: doc.assignedHrUserId ? sid(doc.assignedHrUserId) : undefined,
    completedAt: doc.completedAt as Date | undefined,
    completionOverrideReason: doc.completionOverrideReason
      ? sid(doc.completionOverrideReason)
      : undefined,
    progressPercent: Number(doc.progressPercent ?? 0),
    workScheduleId: doc.workScheduleId ? sid(doc.workScheduleId) : undefined,
    shiftDefinitionId: doc.shiftDefinitionId ? sid(doc.shiftDefinitionId) : undefined,
    compensationStructureId: doc.compensationStructureId
      ? sid(doc.compensationStructureId)
      : undefined,
    createdBy: sid(doc.createdBy),
  }
}

function mapOnboardingTask(doc: LeanDoc) {
  return {
    ...mapBase(doc),
    onboardingId: sid(doc.onboardingId),
    employeeId: sid(doc.employeeId),
    title: sid(doc.title),
    description: doc.description ? sid(doc.description) : undefined,
    category: doc.category ? sid(doc.category) : undefined,
    required: Boolean(doc.required),
    sortOrder: Number(doc.sortOrder ?? 0),
    dependsOnTaskId: doc.dependsOnTaskId ? sid(doc.dependsOnTaskId) : undefined,
    assignedHrUserId: doc.assignedHrUserId ? sid(doc.assignedHrUserId) : undefined,
    dueDate: doc.dueDate as Date | undefined,
    status: sid(doc.status),
    completedAt: doc.completedAt as Date | undefined,
    completedBy: doc.completedBy ? sid(doc.completedBy) : undefined,
    evidenceStorageKey: doc.evidenceStorageKey ? sid(doc.evidenceStorageKey) : undefined,
  }
}

function mapTemplate(doc: LeanDoc) {
  return {
    ...mapBase(doc),
    code: sid(doc.code),
    name: sid(doc.name),
    description: doc.description ? sid(doc.description) : undefined,
    tasks: (doc.tasks as Array<Record<string, unknown>>) ?? [],
    status: sid(doc.status),
    createdBy: sid(doc.createdBy),
  }
}

function mapStage(doc: LeanDoc) {
  return {
    ...mapBase(doc),
    code: sid(doc.code),
    name: sid(doc.name),
    nameAr: doc.nameAr ? sid(doc.nameAr) : undefined,
    sortOrder: Number(doc.sortOrder ?? 0),
    mapsToStatus: sid(doc.mapsToStatus),
    status: sid(doc.status),
  }
}

export async function nextRequisitionNumber(organizationId: string) {
  const doc = await RecruitmentCounterModel.findOneAndUpdate(
    { organizationId: oid(organizationId), name: 'requisition' },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  ).lean()
  const seq = Number((doc as LeanDoc).seq)
  return `REQ-${String(seq).padStart(6, '0')}`
}

// ——— Requisitions ———

export async function insertRequisition(data: Record<string, unknown>) {
  const doc = await JobRequisitionModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    legalEntityId: oid(String(data.legalEntityId)),
    branchId: oid(String(data.branchId)),
    positionId: oid(data.positionId as string | undefined),
    departmentId: oid(data.departmentId as string | undefined),
    hiringManagerEmployeeId: oid(data.hiringManagerEmployeeId as string | undefined),
    recruiterUserId: oid(data.recruiterUserId as string | undefined),
    createdBy: oid(String(data.createdBy)),
  })
  return mapRequisition(doc.toObject() as LeanDoc)
}

export async function findRequisitionById(id: string) {
  const doc = await JobRequisitionModel.findById(oid(id)).lean()
  return doc ? mapRequisition(doc as LeanDoc) : null
}

export async function updateRequisition(
  id: string,
  patch: Record<string, unknown>,
  fromStatuses?: string[],
) {
  if (patch.updatedBy) patch.updatedBy = oid(String(patch.updatedBy))
  if (patch.approvedBy) patch.approvedBy = oid(String(patch.approvedBy))
  const filter: FilterQuery<typeof JobRequisitionModel> = { _id: oid(id) }
  if (fromStatuses?.length) filter.status = { $in: fromStatuses }
  const doc = await JobRequisitionModel.findOneAndUpdate(filter, { $set: patch }, { new: true }).lean()
  return doc ? mapRequisition(doc as LeanDoc) : null
}

export async function listRequisitions(filter: {
  organizationId: string
  status?: string
  branchIds?: string[]
  skip: number
  limit: number
}) {
  const query: FilterQuery<typeof JobRequisitionModel> = {
    organizationId: oid(filter.organizationId),
  }
  if (filter.status) query.status = filter.status
  if (filter.branchIds?.length) query.branchId = { $in: filter.branchIds.map((id) => oid(id)) }
  const [items, total] = await Promise.all([
    JobRequisitionModel.find(query)
      .sort({ createdAt: -1 })
      .skip(filter.skip)
      .limit(filter.limit)
      .lean(),
    JobRequisitionModel.countDocuments(query),
  ])
  return { items: (items as LeanDoc[]).map(mapRequisition), total }
}

// ——— Postings ———

export async function insertPosting(data: Record<string, unknown>) {
  const doc = await JobPostingModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    legalEntityId: oid(String(data.legalEntityId)),
    branchId: oid(String(data.branchId)),
    requisitionId: oid(String(data.requisitionId)),
    departmentId: oid(data.departmentId as string | undefined),
    positionId: oid(data.positionId as string | undefined),
    createdBy: oid(String(data.createdBy)),
  })
  return mapPosting(doc.toObject() as LeanDoc)
}

export async function findPostingById(id: string) {
  const doc = await JobPostingModel.findById(oid(id)).lean()
  return doc ? mapPosting(doc as LeanDoc) : null
}

export async function updatePosting(id: string, patch: Record<string, unknown>) {
  if (patch.updatedBy) patch.updatedBy = oid(String(patch.updatedBy))
  const doc = await JobPostingModel.findByIdAndUpdate(oid(id), { $set: patch }, { new: true }).lean()
  return doc ? mapPosting(doc as LeanDoc) : null
}

export async function listPostings(filter: {
  organizationId: string
  status?: string
  branchIds?: string[]
  skip: number
  limit: number
}) {
  const query: FilterQuery<typeof JobPostingModel> = { organizationId: oid(filter.organizationId) }
  if (filter.status) query.status = filter.status
  if (filter.branchIds?.length) query.branchId = { $in: filter.branchIds.map((id) => oid(id)) }
  const [items, total] = await Promise.all([
    JobPostingModel.find(query).sort({ createdAt: -1 }).skip(filter.skip).limit(filter.limit).lean(),
    JobPostingModel.countDocuments(query),
  ])
  return { items: (items as LeanDoc[]).map(mapPosting), total }
}

// ——— Stages ———

export async function listStages(organizationId: string) {
  const docs = await RecruitmentStageModel.find({
    organizationId: oid(organizationId),
    status: 'ACTIVE',
  })
    .sort({ sortOrder: 1 })
    .lean()
  return (docs as LeanDoc[]).map(mapStage)
}

export async function upsertDefaultStages(
  organizationId: string,
  stages: Array<{ code: string; name: string; sortOrder: number; mapsToStatus: string }>,
) {
  for (const stage of stages) {
    await RecruitmentStageModel.updateOne(
      { organizationId: oid(organizationId), code: stage.code },
      {
        $setOnInsert: {
          organizationId: oid(organizationId),
          code: stage.code,
          name: stage.name,
          sortOrder: stage.sortOrder,
          mapsToStatus: stage.mapsToStatus,
          status: 'ACTIVE',
        },
      },
      { upsert: true },
    )
  }
  return listStages(organizationId)
}

export async function findStageByCode(organizationId: string, code: string) {
  const doc = await RecruitmentStageModel.findOne({
    organizationId: oid(organizationId),
    code: code.toUpperCase(),
  }).lean()
  return doc ? mapStage(doc as LeanDoc) : null
}

// ——— Candidates ———

export async function insertCandidate(data: Record<string, unknown>) {
  const doc = await CandidateModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    legalEntityId: oid(data.legalEntityId as string | undefined),
    branchId: oid(data.branchId as string | undefined),
    recruiterUserId: oid(data.recruiterUserId as string | undefined),
    createdBy: oid(String(data.createdBy)),
  })
  return mapCandidate(doc.toObject() as LeanDoc)
}

export async function findCandidateById(id: string) {
  const doc = await CandidateModel.findById(oid(id)).lean()
  return doc ? mapCandidate(doc as LeanDoc) : null
}

export async function updateCandidate(id: string, patch: Record<string, unknown>) {
  if (patch.updatedBy) patch.updatedBy = oid(String(patch.updatedBy))
  if (patch.employeeId) patch.employeeId = oid(String(patch.employeeId))
  const doc = await CandidateModel.findByIdAndUpdate(oid(id), { $set: patch }, { new: true }).lean()
  return doc ? mapCandidate(doc as LeanDoc) : null
}

export async function findCandidateDuplicates(
  organizationId: string,
  email: string,
  phone?: string,
  excludeId?: string,
) {
  const or: Record<string, unknown>[] = [{ email: email.toLowerCase() }]
  if (phone?.trim()) or.push({ phone: phone.trim() })
  const query: FilterQuery<typeof CandidateModel> = {
    organizationId: oid(organizationId),
    $or: or,
  }
  if (excludeId) query._id = { $ne: oid(excludeId) }
  const docs = await CandidateModel.find(query).limit(10).lean()
  return (docs as LeanDoc[]).map(mapCandidate)
}

export async function listCandidates(filter: {
  organizationId: string
  status?: string
  q?: string
  branchIds?: string[]
  skip: number
  limit: number
}) {
  const query: FilterQuery<typeof CandidateModel> = {
    organizationId: oid(filter.organizationId),
  }
  if (filter.status) query.status = filter.status
  if (filter.branchIds?.length) {
    query.$or = [
      { branchId: { $in: filter.branchIds.map((id) => oid(id)) } },
      { branchId: null },
      { branchId: { $exists: false } },
    ]
  }
  if (filter.q?.trim()) {
    const q = filter.q.trim()
    query.$and = [
      ...(query.$and ?? []),
      {
        $or: [
          { firstName: new RegExp(q, 'i') },
          { lastName: new RegExp(q, 'i') },
          { email: new RegExp(q, 'i') },
          { phone: new RegExp(q, 'i') },
          { currentEmployer: new RegExp(q, 'i') },
          { skills: new RegExp(q, 'i') },
        ],
      },
    ]
  }
  const [items, total] = await Promise.all([
    CandidateModel.find(query).sort({ updatedAt: -1 }).skip(filter.skip).limit(filter.limit).lean(),
    CandidateModel.countDocuments(query),
  ])
  return { items: (items as LeanDoc[]).map(mapCandidate), total }
}

export async function insertCandidateDocument(data: Record<string, unknown>) {
  const doc = await CandidateDocumentModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    candidateId: oid(String(data.candidateId)),
    uploadedBy: oid(String(data.uploadedBy)),
  })
  return {
    id: sid(doc._id),
    organizationId: sid(doc.organizationId),
    candidateId: sid(doc.candidateId),
    documentType: sid(doc.documentType),
    fileName: sid(doc.fileName),
    storageKey: sid(doc.storageKey),
    status: sid(doc.status),
  }
}

export async function listCandidateDocuments(organizationId: string, candidateId: string) {
  const docs = await CandidateDocumentModel.find({
    organizationId: oid(organizationId),
    candidateId: oid(candidateId),
    status: 'ACTIVE',
  })
    .sort({ createdAt: -1 })
    .lean()
  return (docs as LeanDoc[]).map((doc) => ({
    id: sid(doc._id),
    documentType: sid(doc.documentType),
    fileName: sid(doc.fileName),
    storageKey: sid(doc.storageKey),
    createdAt: doc.createdAt as Date,
  }))
}

export async function insertCandidateActivity(data: Record<string, unknown>) {
  await CandidateActivityModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    candidateId: oid(String(data.candidateId)),
    applicationId: oid(data.applicationId as string | undefined),
    createdBy: oid(data.createdBy as string | undefined),
  })
}

export async function listCandidateActivities(
  organizationId: string,
  candidateId: string,
  limit = 50,
) {
  const docs = await CandidateActivityModel.find({
    organizationId: oid(organizationId),
    candidateId: oid(candidateId),
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()
  return (docs as LeanDoc[]).map((doc) => ({
    id: sid(doc._id),
    type: sid(doc.type),
    summary: sid(doc.summary),
    content: doc.content ? sid(doc.content) : undefined,
    internalOnly: Boolean(doc.internalOnly),
    createdAt: doc.createdAt as Date,
    createdBy: doc.createdBy ? sid(doc.createdBy) : undefined,
  }))
}

// ——— Applications ———

export async function insertApplication(data: Record<string, unknown>) {
  try {
    const doc = await ApplicationModel.create({
      ...data,
      organizationId: oid(String(data.organizationId)),
      legalEntityId: oid(String(data.legalEntityId)),
      branchId: oid(String(data.branchId)),
      candidateId: oid(String(data.candidateId)),
      postingId: oid(String(data.postingId)),
      requisitionId: oid(String(data.requisitionId)),
      recruiterUserId: oid(data.recruiterUserId as string | undefined),
      createdBy: oid(String(data.createdBy)),
    })
    return mapApplication(doc.toObject() as LeanDoc)
  } catch (error) {
    if (isDuplicateKey(error) && data.idempotencyKey) {
      const existing = await ApplicationModel.findOne({
        organizationId: oid(String(data.organizationId)),
        idempotencyKey: data.idempotencyKey,
      }).lean()
      return existing ? mapApplication(existing as LeanDoc) : null
    }
    if (isDuplicateKey(error)) return null
    throw error
  }
}

export async function findApplicationById(id: string) {
  const doc = await ApplicationModel.findById(oid(id)).lean()
  return doc ? mapApplication(doc as LeanDoc) : null
}

export async function updateApplication(
  id: string,
  patch: Record<string, unknown>,
  fromStatuses?: string[],
) {
  if (patch.updatedBy) patch.updatedBy = oid(String(patch.updatedBy))
  const filter: FilterQuery<typeof ApplicationModel> = { _id: oid(id) }
  if (fromStatuses?.length) filter.status = { $in: fromStatuses }
  const doc = await ApplicationModel.findOneAndUpdate(filter, { $set: patch }, { new: true }).lean()
  return doc ? mapApplication(doc as LeanDoc) : null
}

export async function listApplications(filter: {
  organizationId: string
  status?: string
  stageCode?: string
  candidateId?: string
  requisitionId?: string
  branchIds?: string[]
  skip: number
  limit: number
}) {
  const query: FilterQuery<typeof ApplicationModel> = {
    organizationId: oid(filter.organizationId),
  }
  if (filter.status) query.status = filter.status
  if (filter.stageCode) query.stageCode = filter.stageCode
  if (filter.candidateId) query.candidateId = oid(filter.candidateId)
  if (filter.requisitionId) query.requisitionId = oid(filter.requisitionId)
  if (filter.branchIds?.length) query.branchId = { $in: filter.branchIds.map((id) => oid(id)) }
  const [items, total] = await Promise.all([
    ApplicationModel.find(query)
      .sort({ appliedAt: -1 })
      .skip(filter.skip)
      .limit(filter.limit)
      .lean(),
    ApplicationModel.countDocuments(query),
  ])
  return { items: (items as LeanDoc[]).map(mapApplication), total }
}

export async function insertStageHistory(data: Record<string, unknown>) {
  await ApplicationStageHistoryModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    applicationId: oid(String(data.applicationId)),
    changedBy: oid(String(data.changedBy)),
  })
}

// ——— Interviews ———

export async function insertInterview(data: Record<string, unknown>) {
  const doc = await InterviewModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    legalEntityId: oid(String(data.legalEntityId)),
    branchId: oid(String(data.branchId)),
    candidateId: oid(String(data.candidateId)),
    applicationId: oid(String(data.applicationId)),
    interviewerUserIds: ((data.interviewerUserIds as string[]) ?? []).map((id) => oid(id)),
    createdBy: oid(String(data.createdBy)),
  })
  return mapInterview(doc.toObject() as LeanDoc)
}

export async function findInterviewById(id: string) {
  const doc = await InterviewModel.findById(oid(id)).lean()
  return doc ? mapInterview(doc as LeanDoc) : null
}

export async function updateInterview(id: string, patch: Record<string, unknown>) {
  if (patch.updatedBy) patch.updatedBy = oid(String(patch.updatedBy))
  const doc = await InterviewModel.findByIdAndUpdate(oid(id), { $set: patch }, { new: true }).lean()
  return doc ? mapInterview(doc as LeanDoc) : null
}

export async function listInterviews(filter: {
  organizationId: string
  status?: string
  from?: Date
  to?: Date
  branchIds?: string[]
  skip: number
  limit: number
}) {
  const query: FilterQuery<typeof InterviewModel> = {
    organizationId: oid(filter.organizationId),
  }
  if (filter.status) query.status = filter.status
  if (filter.branchIds?.length) query.branchId = { $in: filter.branchIds.map((id) => oid(id)) }
  if (filter.from || filter.to) {
    query.scheduledStart = {}
    if (filter.from) (query.scheduledStart as Record<string, Date>).$gte = filter.from
    if (filter.to) (query.scheduledStart as Record<string, Date>).$lte = filter.to
  }
  const [items, total] = await Promise.all([
    InterviewModel.find(query)
      .sort({ scheduledStart: 1 })
      .skip(filter.skip)
      .limit(filter.limit)
      .lean(),
    InterviewModel.countDocuments(query),
  ])
  return { items: (items as LeanDoc[]).map(mapInterview), total }
}

export async function findOverlappingInterviews(input: {
  organizationId: string
  candidateId: string
  interviewerUserIds: string[]
  start: Date
  end: Date
  excludeId?: string
}) {
  const query: FilterQuery<typeof InterviewModel> = {
    organizationId: oid(input.organizationId),
    status: { $in: ['SCHEDULED', 'CONFIRMED', 'RESCHEDULED'] },
    scheduledStart: { $lt: input.end },
    scheduledEnd: { $gt: input.start },
    $or: [
      { candidateId: oid(input.candidateId) },
      { interviewerUserIds: { $in: input.interviewerUserIds.map((id) => oid(id)) } },
    ],
  }
  if (input.excludeId) query._id = { $ne: oid(input.excludeId) }
  const docs = await InterviewModel.find(query).limit(20).lean()
  return (docs as LeanDoc[]).map(mapInterview)
}

export async function insertInterviewFeedback(data: Record<string, unknown>) {
  try {
    const doc = await InterviewFeedbackModel.create({
      ...data,
      organizationId: oid(String(data.organizationId)),
      interviewId: oid(String(data.interviewId)),
      applicationId: oid(String(data.applicationId)),
      candidateId: oid(String(data.candidateId)),
      interviewerUserId: oid(String(data.interviewerUserId)),
    })
    return {
      id: sid(doc._id),
      interviewId: sid(doc.interviewId),
      recommendation: sid(doc.recommendation),
      rating: doc.rating != null ? Number(doc.rating) : undefined,
    }
  } catch (error) {
    if (isDuplicateKey(error)) return null
    throw error
  }
}

export async function listInterviewFeedback(organizationId: string, interviewId: string) {
  const docs = await InterviewFeedbackModel.find({
    organizationId: oid(organizationId),
    interviewId: oid(interviewId),
  }).lean()
  return (docs as LeanDoc[]).map((doc) => ({
    id: sid(doc._id),
    interviewerUserId: sid(doc.interviewerUserId),
    rating: doc.rating != null ? Number(doc.rating) : undefined,
    recommendation: sid(doc.recommendation),
    strengths: doc.strengths ? sid(doc.strengths) : undefined,
    concerns: doc.concerns ? sid(doc.concerns) : undefined,
    notes: doc.notes ? sid(doc.notes) : undefined,
    submittedAt: doc.submittedAt as Date,
  }))
}

// ——— Offers ———

export async function insertOffer(data: Record<string, unknown>) {
  try {
    const doc = await OfferModel.create({
      ...data,
      organizationId: oid(String(data.organizationId)),
      legalEntityId: oid(String(data.legalEntityId)),
      branchId: oid(String(data.branchId)),
      candidateId: oid(String(data.candidateId)),
      applicationId: oid(String(data.applicationId)),
      requisitionId: oid(String(data.requisitionId)),
      positionId: oid(data.positionId as string | undefined),
      departmentId: oid(data.departmentId as string | undefined),
      compensationStructureId: oid(data.compensationStructureId as string | undefined),
      createdBy: oid(String(data.createdBy)),
    })
    return mapOffer(doc.toObject() as LeanDoc)
  } catch (error) {
    if (isDuplicateKey(error) && data.idempotencyKey) {
      const existing = await OfferModel.findOne({
        organizationId: oid(String(data.organizationId)),
        idempotencyKey: data.idempotencyKey,
      }).lean()
      return existing ? mapOffer(existing as LeanDoc) : null
    }
    throw error
  }
}

export async function findOfferById(id: string) {
  const doc = await OfferModel.findById(oid(id)).lean()
  return doc ? mapOffer(doc as LeanDoc) : null
}

export async function findActiveOfferForApplication(organizationId: string, applicationId: string) {
  const doc = await OfferModel.findOne({
    organizationId: oid(organizationId),
    applicationId: oid(applicationId),
    status: {
      $in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'VIEWED'],
    },
  }).lean()
  return doc ? mapOffer(doc as LeanDoc) : null
}

export async function updateOffer(
  id: string,
  patch: Record<string, unknown>,
  fromStatuses?: string[],
) {
  if (patch.updatedBy) patch.updatedBy = oid(String(patch.updatedBy))
  if (patch.approvedBy) patch.approvedBy = oid(String(patch.approvedBy))
  const filter: FilterQuery<typeof OfferModel> = { _id: oid(id) }
  if (fromStatuses?.length) filter.status = { $in: fromStatuses }
  const doc = await OfferModel.findOneAndUpdate(filter, { $set: patch }, { new: true }).lean()
  return doc ? mapOffer(doc as LeanDoc) : null
}

export async function listOffers(filter: {
  organizationId: string
  status?: string
  candidateId?: string
  branchIds?: string[]
  skip: number
  limit: number
}) {
  const query: FilterQuery<typeof OfferModel> = { organizationId: oid(filter.organizationId) }
  if (filter.status) query.status = filter.status
  if (filter.candidateId) query.candidateId = oid(filter.candidateId)
  if (filter.branchIds?.length) query.branchId = { $in: filter.branchIds.map((id) => oid(id)) }
  const [items, total] = await Promise.all([
    OfferModel.find(query).sort({ createdAt: -1 }).skip(filter.skip).limit(filter.limit).lean(),
    OfferModel.countDocuments(query),
  ])
  return { items: (items as LeanDoc[]).map(mapOffer), total }
}

/** Open offers past expiry — for background expiry job. */
export async function listExpiredOpenOffers(limit = 100) {
  const docs = await OfferModel.find({
    status: { $in: ['SENT', 'VIEWED'] },
    expiresAt: { $lt: new Date() },
  })
    .limit(limit)
    .lean()
  return (docs as LeanDoc[]).map(mapOffer)
}

export async function insertOfferApproval(data: Record<string, unknown>) {
  await OfferApprovalModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    offerId: oid(String(data.offerId)),
    actorUserId: oid(String(data.actorUserId)),
  })
}

// ——— Onboarding ———

export async function insertOnboardingTemplate(data: Record<string, unknown>) {
  const doc = await OnboardingTemplateModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    createdBy: oid(String(data.createdBy)),
  })
  return mapTemplate(doc.toObject() as LeanDoc)
}

export async function findOnboardingTemplateById(id: string) {
  const doc = await OnboardingTemplateModel.findById(oid(id)).lean()
  return doc ? mapTemplate(doc as LeanDoc) : null
}

export async function listOnboardingTemplates(organizationId: string) {
  const docs = await OnboardingTemplateModel.find({
    organizationId: oid(organizationId),
    status: 'ACTIVE',
  })
    .sort({ name: 1 })
    .lean()
  return (docs as LeanDoc[]).map(mapTemplate)
}

export async function insertOnboarding(data: Record<string, unknown>) {
  try {
    const doc = await EmployeeOnboardingModel.create({
      ...data,
      organizationId: oid(String(data.organizationId)),
      legalEntityId: oid(String(data.legalEntityId)),
      branchId: oid(String(data.branchId)),
      employeeId: oid(String(data.employeeId)),
      candidateId: oid(data.candidateId as string | undefined),
      offerId: oid(data.offerId as string | undefined),
      applicationId: oid(data.applicationId as string | undefined),
      templateId: oid(data.templateId as string | undefined),
      assignedHrUserId: oid(data.assignedHrUserId as string | undefined),
      workScheduleId: oid(data.workScheduleId as string | undefined),
      shiftDefinitionId: oid(data.shiftDefinitionId as string | undefined),
      compensationStructureId: oid(data.compensationStructureId as string | undefined),
      createdBy: oid(String(data.createdBy)),
    })
    return mapOnboarding(doc.toObject() as LeanDoc)
  } catch (error) {
    if (isDuplicateKey(error)) {
      if (data.idempotencyKey) {
        const byKey = await EmployeeOnboardingModel.findOne({
          organizationId: oid(String(data.organizationId)),
          idempotencyKey: data.idempotencyKey,
        }).lean()
        if (byKey) return mapOnboarding(byKey as LeanDoc)
      }
      const byEmp = await EmployeeOnboardingModel.findOne({
        organizationId: oid(String(data.organizationId)),
        employeeId: oid(String(data.employeeId)),
      }).lean()
      return byEmp ? mapOnboarding(byEmp as LeanDoc) : null
    }
    throw error
  }
}

export async function findOnboardingById(id: string) {
  const doc = await EmployeeOnboardingModel.findById(oid(id)).lean()
  return doc ? mapOnboarding(doc as LeanDoc) : null
}

export async function updateOnboarding(id: string, patch: Record<string, unknown>) {
  if (patch.updatedBy) patch.updatedBy = oid(String(patch.updatedBy))
  const doc = await EmployeeOnboardingModel.findByIdAndUpdate(
    oid(id),
    { $set: patch },
    { new: true },
  ).lean()
  return doc ? mapOnboarding(doc as LeanDoc) : null
}

export async function listOnboardings(filter: {
  organizationId: string
  status?: string
  branchIds?: string[]
  skip: number
  limit: number
}) {
  const query: FilterQuery<typeof EmployeeOnboardingModel> = {
    organizationId: oid(filter.organizationId),
  }
  if (filter.status) query.status = filter.status
  if (filter.branchIds?.length) query.branchId = { $in: filter.branchIds.map((id) => oid(id)) }
  const [items, total] = await Promise.all([
    EmployeeOnboardingModel.find(query)
      .sort({ startDate: -1 })
      .skip(filter.skip)
      .limit(filter.limit)
      .lean(),
    EmployeeOnboardingModel.countDocuments(query),
  ])
  return { items: (items as LeanDoc[]).map(mapOnboarding), total }
}

export async function insertOnboardingTask(data: Record<string, unknown>) {
  const doc = await OnboardingTaskModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    onboardingId: oid(String(data.onboardingId)),
    employeeId: oid(String(data.employeeId)),
    dependsOnTaskId: oid(data.dependsOnTaskId as string | undefined),
    assignedHrUserId: oid(data.assignedHrUserId as string | undefined),
  })
  return mapOnboardingTask(doc.toObject() as LeanDoc)
}

export async function findOnboardingTaskById(id: string) {
  const doc = await OnboardingTaskModel.findById(oid(id)).lean()
  return doc ? mapOnboardingTask(doc as LeanDoc) : null
}

export async function updateOnboardingTask(id: string, patch: Record<string, unknown>) {
  if (patch.completedBy) patch.completedBy = oid(String(patch.completedBy))
  const doc = await OnboardingTaskModel.findByIdAndUpdate(
    oid(id),
    { $set: patch },
    { new: true },
  ).lean()
  return doc ? mapOnboardingTask(doc as LeanDoc) : null
}

export async function listOnboardingTasks(organizationId: string, onboardingId: string) {
  const docs = await OnboardingTaskModel.find({
    organizationId: oid(organizationId),
    onboardingId: oid(onboardingId),
  })
    .sort({ sortOrder: 1 })
    .lean()
  return (docs as LeanDoc[]).map(mapOnboardingTask)
}

export async function insertCandidateInvitation(data: Record<string, unknown>) {
  const doc = await CandidateInvitationModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    candidateId: oid(String(data.candidateId)),
    offerId: oid(data.offerId as string | undefined),
    createdBy: oid(String(data.createdBy)),
  })
  return {
    id: sid(doc._id),
    expiresAt: doc.expiresAt as Date,
    purpose: sid(doc.purpose),
  }
}

export async function findInvitationByTokenHash(tokenHash: string) {
  const doc = await CandidateInvitationModel.findOne({ tokenHash }).lean()
  if (!doc) return null
  return {
    id: sid(doc._id),
    organizationId: sid(doc.organizationId),
    candidateId: sid(doc.candidateId),
    offerId: doc.offerId ? sid(doc.offerId) : undefined,
    purpose: sid(doc.purpose),
    expiresAt: doc.expiresAt as Date,
    usedAt: doc.usedAt as Date | undefined,
    revokedAt: doc.revokedAt as Date | undefined,
  }
}

export async function markInvitationUsed(id: string) {
  await CandidateInvitationModel.findOneAndUpdate(
    { _id: oid(id), usedAt: null, revokedAt: null },
    { $set: { usedAt: new Date() } },
  )
}

export async function tryInsertRecruitmentNotificationIntent(data: {
  organizationId: string
  candidateId?: string
  intentKey: string
  kind: string
  payload?: Record<string, unknown>
}) {
  try {
    await RecruitmentNotificationIntentModel.create({
      organizationId: oid(data.organizationId),
      candidateId: oid(data.candidateId),
      intentKey: data.intentKey,
      kind: data.kind,
      payload: data.payload,
    })
    return true
  } catch (error) {
    if (isDuplicateKey(error)) return false
    throw error
  }
}

export async function tryInsertRecruitmentOutboxEvent(data: {
  organizationId: string
  eventKey: string
  eventType: string
  payload?: Record<string, unknown>
}) {
  try {
    await RecruitmentOutboxEventModel.create({
      organizationId: oid(data.organizationId),
      eventKey: data.eventKey,
      eventType: data.eventType,
      payload: data.payload,
    })
    return true
  } catch (error) {
    if (isDuplicateKey(error)) return false
    throw error
  }
}

export async function countByStatus(
  collection:
    | 'job_requisitions'
    | 'applications'
    | 'offers'
    | 'employee_onboardings'
    | 'interviews',
  organizationId: string,
  branchIds?: string[],
) {
  const modelMap = {
    job_requisitions: JobRequisitionModel,
    applications: ApplicationModel,
    offers: OfferModel,
    employee_onboardings: EmployeeOnboardingModel,
    interviews: InterviewModel,
  } as const
  const Model = modelMap[collection]
  const match: Record<string, unknown> = { organizationId: oid(organizationId) }
  if (branchIds?.length) match.branchId = { $in: branchIds.map((id) => oid(id)) }
  const rows = await Model.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }])
  const result: Record<string, number> = {}
  for (const row of rows) result[String(row._id)] = Number(row.count)
  return result
}
