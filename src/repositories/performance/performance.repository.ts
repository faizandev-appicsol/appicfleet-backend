import type { FilterQuery } from 'mongoose'
import {
  CalibrationSessionModel,
  CompetencyFrameworkModel,
  ContinuousFeedbackModel,
  DevelopmentPlanModel,
  EmployeeGoalModel,
  GoalProgressHistoryModel,
  KpiDefinitionModel,
  OneOnOneModel,
  PeerReviewModel,
  PerformanceCycleModel,
  PerformanceImprovementPlanModel,
  PerformanceReviewModel,
  PerformanceTemplateModel,
  RatingScaleModel,
  RecognitionModel,
  SuccessionPlanModel,
  TrainingRecommendationModel,
} from '../../models/performance.model.js'
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

function mapScale(doc: LeanDoc) {
  return {
    ...mapBase(doc),
    name: sid(doc.name),
    description: doc.description ? sid(doc.description) : undefined,
    minValue: Number(doc.minValue),
    maxValue: Number(doc.maxValue),
    levels: (doc.levels as unknown[]) ?? [],
    status: sid(doc.status),
    createdBy: sid(doc.createdBy),
  }
}

function mapTemplate(doc: LeanDoc) {
  return {
    ...mapBase(doc),
    name: sid(doc.name),
    description: doc.description ? sid(doc.description) : undefined,
    reviewType: sid(doc.reviewType),
    version: Number(doc.version),
    includeGoals: Boolean(doc.includeGoals),
    includeKpis: Boolean(doc.includeKpis),
    includeCompetencies: Boolean(doc.includeCompetencies),
    includeSelfReview: Boolean(doc.includeSelfReview),
    includeManagerReview: Boolean(doc.includeManagerReview),
    includePeerReview: Boolean(doc.includePeerReview),
    includeDevelopment: Boolean(doc.includeDevelopment),
    requireGoalWeightTotal100: Boolean(doc.requireGoalWeightTotal100),
    sections: (doc.sections as unknown[]) ?? [],
    status: sid(doc.status),
    createdBy: sid(doc.createdBy),
  }
}

function mapCycle(doc: LeanDoc) {
  return {
    ...mapBase(doc),
    legalEntityId: doc.legalEntityId ? sid(doc.legalEntityId) : undefined,
    branchIds: ((doc.branchIds as unknown[]) ?? []).map((id) => sid(id)),
    departmentIds: ((doc.departmentIds as unknown[]) ?? []).map((id) => sid(id)),
    name: sid(doc.name),
    description: doc.description ? sid(doc.description) : undefined,
    reviewType: sid(doc.reviewType),
    startDate: doc.startDate as Date,
    endDate: doc.endDate as Date,
    reviewDeadline: doc.reviewDeadline as Date | undefined,
    status: sid(doc.status),
    ratingScaleId: sid(doc.ratingScaleId),
    templateId: sid(doc.templateId),
    templateVersion: Number(doc.templateVersion),
    templateSnapshot: doc.templateSnapshot,
    ratingScaleSnapshot: doc.ratingScaleSnapshot,
    requirePeerReview: Boolean(doc.requirePeerReview),
    requireCalibration: Boolean(doc.requireCalibration),
    createdBy: sid(doc.createdBy),
    approvedBy: doc.approvedBy ? sid(doc.approvedBy) : undefined,
    openedAt: doc.openedAt as Date | undefined,
    completedAt: doc.completedAt as Date | undefined,
  }
}

function mapGoal(doc: LeanDoc) {
  return {
    ...mapBase(doc),
    legalEntityId: doc.legalEntityId ? sid(doc.legalEntityId) : undefined,
    branchId: doc.branchId ? sid(doc.branchId) : undefined,
    employeeId: sid(doc.employeeId),
    managerEmployeeId: doc.managerEmployeeId ? sid(doc.managerEmployeeId) : undefined,
    cycleId: doc.cycleId ? sid(doc.cycleId) : undefined,
    reviewId: doc.reviewId ? sid(doc.reviewId) : undefined,
    title: sid(doc.title),
    description: doc.description ? sid(doc.description) : undefined,
    category: doc.category ? sid(doc.category) : undefined,
    startDate: doc.startDate as Date | undefined,
    dueDate: doc.dueDate as Date | undefined,
    weight: sid(doc.weight ?? '0.00'),
    targetValue: doc.targetValue ? sid(doc.targetValue) : undefined,
    currentValue: doc.currentValue ? sid(doc.currentValue) : undefined,
    unit: doc.unit ? sid(doc.unit) : undefined,
    progressPercent: sid(doc.progressPercent ?? '0.00'),
    measurementMethod: sid(doc.measurementMethod ?? 'MANUAL_PERCENT'),
    priority: sid(doc.priority),
    status: sid(doc.status),
    employeeComments: doc.employeeComments ? sid(doc.employeeComments) : undefined,
    managerComments: doc.managerComments ? sid(doc.managerComments) : undefined,
    createdBy: sid(doc.createdBy),
  }
}

function mapReview(doc: LeanDoc) {
  return {
    ...mapBase(doc),
    legalEntityId: doc.legalEntityId ? sid(doc.legalEntityId) : undefined,
    branchId: doc.branchId ? sid(doc.branchId) : undefined,
    cycleId: sid(doc.cycleId),
    employeeId: sid(doc.employeeId),
    managerEmployeeId: doc.managerEmployeeId ? sid(doc.managerEmployeeId) : undefined,
    templateId: sid(doc.templateId),
    templateVersion: Number(doc.templateVersion),
    templateSnapshot: doc.templateSnapshot,
    ratingScaleSnapshot: doc.ratingScaleSnapshot,
    competencySnapshot: doc.competencySnapshot,
    status: sid(doc.status),
    selfAssessment: doc.selfAssessment,
    managerAssessment: doc.managerAssessment,
    originalManagerRating:
      doc.originalManagerRating != null ? Number(doc.originalManagerRating) : undefined,
    calibratedRating: doc.calibratedRating != null ? Number(doc.calibratedRating) : undefined,
    finalRating: doc.finalRating != null ? Number(doc.finalRating) : undefined,
    ratingBreakdown: doc.ratingBreakdown,
    finalComments: doc.finalComments ? sid(doc.finalComments) : undefined,
    meetingScheduledAt: doc.meetingScheduledAt as Date | undefined,
    meetingCompletedAt: doc.meetingCompletedAt as Date | undefined,
    meetingNotes: doc.meetingNotes ? sid(doc.meetingNotes) : undefined,
    finalizedAt: doc.finalizedAt as Date | undefined,
    finalizedBy: doc.finalizedBy ? sid(doc.finalizedBy) : undefined,
    createdBy: sid(doc.createdBy),
  }
}

export type RatingScaleRecord = ReturnType<typeof mapScale>
export type PerformanceTemplateRecord = ReturnType<typeof mapTemplate>
export type PerformanceCycleRecord = ReturnType<typeof mapCycle>
export type EmployeeGoalRecord = ReturnType<typeof mapGoal>
export type PerformanceReviewRecord = ReturnType<typeof mapReview>

export async function insertRatingScale(data: Record<string, unknown>) {
  const doc = await RatingScaleModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    createdBy: oid(String(data.createdBy)),
  })
  return mapScale(doc.toObject() as LeanDoc)
}

export async function findRatingScaleById(id: string) {
  const doc = await RatingScaleModel.findById(oid(id)).lean()
  return doc ? mapScale(doc as LeanDoc) : null
}

export async function listRatingScales(organizationId: string) {
  const docs = await RatingScaleModel.find({
    organizationId: oid(organizationId),
    status: 'ACTIVE',
  })
    .sort({ name: 1 })
    .lean()
  return (docs as LeanDoc[]).map(mapScale)
}

export async function insertTemplate(data: Record<string, unknown>) {
  const doc = await PerformanceTemplateModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    createdBy: oid(String(data.createdBy)),
  })
  return mapTemplate(doc.toObject() as LeanDoc)
}

export async function findTemplateById(id: string) {
  const doc = await PerformanceTemplateModel.findById(oid(id)).lean()
  return doc ? mapTemplate(doc as LeanDoc) : null
}

export async function listTemplates(organizationId: string) {
  const docs = await PerformanceTemplateModel.find({
    organizationId: oid(organizationId),
    status: 'ACTIVE',
  })
    .sort({ name: 1, version: -1 })
    .lean()
  return (docs as LeanDoc[]).map(mapTemplate)
}

export async function insertCycle(data: Record<string, unknown>) {
  const doc = await PerformanceCycleModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    legalEntityId: data.legalEntityId ? oid(String(data.legalEntityId)) : undefined,
    branchIds: ((data.branchIds as string[]) ?? []).map((id) => oid(id)),
    departmentIds: ((data.departmentIds as string[]) ?? []).map((id) => oid(id)),
    ratingScaleId: oid(String(data.ratingScaleId)),
    templateId: oid(String(data.templateId)),
    createdBy: oid(String(data.createdBy)),
  })
  return mapCycle(doc.toObject() as LeanDoc)
}

export async function findCycleById(id: string) {
  const doc = await PerformanceCycleModel.findById(oid(id)).lean()
  return doc ? mapCycle(doc as LeanDoc) : null
}

export async function updateCycle(id: string, patch: Record<string, unknown>, fromStatuses?: string[]) {
  if (patch.approvedBy) patch.approvedBy = oid(String(patch.approvedBy))
  const filter: FilterQuery<typeof PerformanceCycleModel> = { _id: oid(id) }
  if (fromStatuses?.length) filter.status = { $in: fromStatuses }
  const doc = await PerformanceCycleModel.findOneAndUpdate(filter, { $set: patch }, { new: true }).lean()
  return doc ? mapCycle(doc as LeanDoc) : null
}

export async function listCycles(filter: {
  organizationId: string
  status?: string
  skip: number
  limit: number
}) {
  const query: FilterQuery<typeof PerformanceCycleModel> = {
    organizationId: oid(filter.organizationId),
  }
  if (filter.status) query.status = filter.status
  const [items, total] = await Promise.all([
    PerformanceCycleModel.find(query)
      .sort({ startDate: -1 })
      .skip(filter.skip)
      .limit(filter.limit)
      .lean(),
    PerformanceCycleModel.countDocuments(query),
  ])
  return { items: (items as LeanDoc[]).map(mapCycle), total }
}

export async function insertFramework(data: Record<string, unknown>) {
  const doc = await CompetencyFrameworkModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    createdBy: oid(String(data.createdBy)),
  })
  return {
    ...mapBase(doc.toObject() as LeanDoc),
    name: sid(doc.name),
    competencies: doc.competencies,
    status: sid(doc.status),
  }
}

export async function listFrameworks(organizationId: string) {
  const docs = await CompetencyFrameworkModel.find({
    organizationId: oid(organizationId),
    status: 'ACTIVE',
  })
    .sort({ name: 1 })
    .lean()
  return (docs as LeanDoc[]).map((doc) => ({
    ...mapBase(doc),
    name: sid(doc.name),
    description: doc.description ? sid(doc.description) : undefined,
    competencies: doc.competencies,
    status: sid(doc.status),
  }))
}

export async function findFrameworkById(id: string) {
  const doc = await CompetencyFrameworkModel.findById(oid(id)).lean()
  if (!doc) return null
  const d = doc as LeanDoc
  return {
    ...mapBase(d),
    name: sid(d.name),
    competencies: d.competencies,
    status: sid(d.status),
  }
}

export async function insertKpi(data: Record<string, unknown>) {
  const doc = await KpiDefinitionModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    createdBy: oid(String(data.createdBy)),
  })
  return {
    ...mapBase(doc.toObject() as LeanDoc),
    name: sid(doc.name),
    dataSource: sid(doc.dataSource),
    status: sid(doc.status),
  }
}

export async function listKpis(organizationId: string) {
  const docs = await KpiDefinitionModel.find({
    organizationId: oid(organizationId),
    status: 'ACTIVE',
  })
    .sort({ name: 1 })
    .lean()
  return (docs as LeanDoc[]).map((doc) => ({
    ...mapBase(doc),
    name: sid(doc.name),
    category: doc.category ? sid(doc.category) : undefined,
    unit: doc.unit ? sid(doc.unit) : undefined,
    dataSource: sid(doc.dataSource),
    status: sid(doc.status),
  }))
}

export async function insertGoal(data: Record<string, unknown>) {
  const doc = await EmployeeGoalModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    legalEntityId: data.legalEntityId ? oid(String(data.legalEntityId)) : undefined,
    branchId: data.branchId ? oid(String(data.branchId)) : undefined,
    employeeId: oid(String(data.employeeId)),
    managerEmployeeId: data.managerEmployeeId ? oid(String(data.managerEmployeeId)) : undefined,
    cycleId: data.cycleId ? oid(String(data.cycleId)) : undefined,
    reviewId: data.reviewId ? oid(String(data.reviewId)) : undefined,
    createdBy: oid(String(data.createdBy)),
  })
  return mapGoal(doc.toObject() as LeanDoc)
}

export async function findGoalById(id: string) {
  const doc = await EmployeeGoalModel.findById(oid(id)).lean()
  return doc ? mapGoal(doc as LeanDoc) : null
}

export async function updateGoal(id: string, patch: Record<string, unknown>) {
  if (patch.updatedBy) patch.updatedBy = oid(String(patch.updatedBy))
  const doc = await EmployeeGoalModel.findByIdAndUpdate(oid(id), { $set: patch }, { new: true }).lean()
  return doc ? mapGoal(doc as LeanDoc) : null
}

export async function listGoals(filter: {
  organizationId: string
  employeeId?: string
  cycleId?: string
  status?: string
  branchIds?: string[]
  skip: number
  limit: number
}) {
  const query: FilterQuery<typeof EmployeeGoalModel> = {
    organizationId: oid(filter.organizationId),
  }
  if (filter.employeeId) query.employeeId = oid(filter.employeeId)
  if (filter.cycleId) query.cycleId = oid(filter.cycleId)
  if (filter.status) query.status = filter.status
  if (filter.branchIds?.length) query.branchId = { $in: filter.branchIds.map((id) => oid(id)) }
  const [items, total] = await Promise.all([
    EmployeeGoalModel.find(query).sort({ updatedAt: -1 }).skip(filter.skip).limit(filter.limit).lean(),
    EmployeeGoalModel.countDocuments(query),
  ])
  return { items: (items as LeanDoc[]).map(mapGoal), total }
}

export async function insertGoalProgress(data: Record<string, unknown>) {
  await GoalProgressHistoryModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    goalId: oid(String(data.goalId)),
    changedBy: oid(String(data.changedBy)),
  })
}

export async function insertReview(data: Record<string, unknown>) {
  try {
    const doc = await PerformanceReviewModel.create({
      ...data,
      organizationId: oid(String(data.organizationId)),
      legalEntityId: data.legalEntityId ? oid(String(data.legalEntityId)) : undefined,
      branchId: data.branchId ? oid(String(data.branchId)) : undefined,
      cycleId: oid(String(data.cycleId)),
      employeeId: oid(String(data.employeeId)),
      managerEmployeeId: data.managerEmployeeId ? oid(String(data.managerEmployeeId)) : undefined,
      templateId: oid(String(data.templateId)),
      createdBy: oid(String(data.createdBy)),
    })
    return mapReview(doc.toObject() as LeanDoc)
  } catch (error) {
    if (!isDuplicateKey(error)) throw error
    return null
  }
}

export async function findReviewById(id: string) {
  const doc = await PerformanceReviewModel.findById(oid(id)).lean()
  return doc ? mapReview(doc as LeanDoc) : null
}

export async function updateReview(
  id: string,
  patch: Record<string, unknown>,
  fromStatuses?: string[],
) {
  if (patch.updatedBy) patch.updatedBy = oid(String(patch.updatedBy))
  if (patch.finalizedBy) patch.finalizedBy = oid(String(patch.finalizedBy))
  const filter: FilterQuery<typeof PerformanceReviewModel> = { _id: oid(id) }
  if (fromStatuses?.length) filter.status = { $in: fromStatuses }
  const doc = await PerformanceReviewModel.findOneAndUpdate(filter, { $set: patch }, { new: true }).lean()
  return doc ? mapReview(doc as LeanDoc) : null
}

export async function listReviews(filter: {
  organizationId: string
  cycleId?: string
  employeeId?: string
  managerEmployeeId?: string
  status?: string
  branchIds?: string[]
  skip: number
  limit: number
}) {
  const query: FilterQuery<typeof PerformanceReviewModel> = {
    organizationId: oid(filter.organizationId),
  }
  if (filter.cycleId) query.cycleId = oid(filter.cycleId)
  if (filter.employeeId) query.employeeId = oid(filter.employeeId)
  if (filter.managerEmployeeId) query.managerEmployeeId = oid(filter.managerEmployeeId)
  if (filter.status) query.status = filter.status
  if (filter.branchIds?.length) query.branchId = { $in: filter.branchIds.map((id) => oid(id)) }
  const [items, total] = await Promise.all([
    PerformanceReviewModel.find(query)
      .sort({ updatedAt: -1 })
      .skip(filter.skip)
      .limit(filter.limit)
      .lean(),
    PerformanceReviewModel.countDocuments(query),
  ])
  return { items: (items as LeanDoc[]).map(mapReview), total }
}

export async function insertPeerReview(data: Record<string, unknown>) {
  try {
    const doc = await PeerReviewModel.create({
      ...data,
      organizationId: oid(String(data.organizationId)),
      reviewId: oid(String(data.reviewId)),
      employeeId: oid(String(data.employeeId)),
      reviewerEmployeeId: oid(String(data.reviewerEmployeeId)),
      createdBy: oid(String(data.createdBy)),
    })
    return {
      id: sid(doc._id),
      reviewId: sid(doc.reviewId),
      status: sid(doc.status),
      confidentiality: sid(doc.confidentiality),
    }
  } catch (error) {
    if (!isDuplicateKey(error)) throw error
    return null
  }
}

export async function updatePeerReview(id: string, patch: Record<string, unknown>) {
  const doc = await PeerReviewModel.findByIdAndUpdate(oid(id), { $set: patch }, { new: true }).lean()
  if (!doc) return null
  const d = doc as LeanDoc
  return {
    id: sid(d._id),
    reviewId: sid(d.reviewId),
    status: sid(d.status),
    confidentiality: sid(d.confidentiality),
    comments: d.comments ? sid(d.comments) : undefined,
    ratings: d.ratings,
    reviewerEmployeeId: sid(d.reviewerEmployeeId),
  }
}

export async function listPeerReviews(organizationId: string, reviewId: string) {
  const docs = await PeerReviewModel.find({
    organizationId: oid(organizationId),
    reviewId: oid(reviewId),
  }).lean()
  return (docs as LeanDoc[]).map((d) => ({
    id: sid(d._id),
    reviewId: sid(d.reviewId),
    status: sid(d.status),
    confidentiality: sid(d.confidentiality),
    comments: d.comments ? sid(d.comments) : undefined,
    ratings: d.ratings,
    reviewerEmployeeId: sid(d.reviewerEmployeeId),
    submittedAt: d.submittedAt as Date | undefined,
  }))
}

export async function insertCalibration(data: Record<string, unknown>) {
  const doc = await CalibrationSessionModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    cycleId: oid(String(data.cycleId)),
    createdBy: oid(String(data.createdBy)),
    participants: ((data.participants as Array<Record<string, unknown>>) ?? []).map((p) => ({
      ...p,
      reviewId: oid(String(p.reviewId)),
      employeeId: oid(String(p.employeeId)),
    })),
  })
  return {
    id: sid(doc._id),
    organizationId: sid(doc.organizationId),
    cycleId: sid(doc.cycleId),
    name: sid(doc.name),
    status: sid(doc.status),
    participants: doc.participants,
  }
}

export async function findCalibrationById(id: string) {
  const doc = await CalibrationSessionModel.findById(oid(id)).lean()
  if (!doc) return null
  const d = doc as LeanDoc
  return {
    id: sid(d._id),
    organizationId: sid(d.organizationId),
    cycleId: sid(d.cycleId),
    name: sid(d.name),
    status: sid(d.status),
    participants: d.participants,
    comments: d.comments ? sid(d.comments) : undefined,
  }
}

export async function updateCalibration(id: string, patch: Record<string, unknown>) {
  if (patch.finalizedBy) patch.finalizedBy = oid(String(patch.finalizedBy))
  const doc = await CalibrationSessionModel.findByIdAndUpdate(oid(id), { $set: patch }, { new: true }).lean()
  if (!doc) return null
  const d = doc as LeanDoc
  return {
    id: sid(d._id),
    status: sid(d.status),
    participants: d.participants,
  }
}

export async function listCalibrations(organizationId: string, cycleId?: string) {
  const query: FilterQuery<typeof CalibrationSessionModel> = {
    organizationId: oid(organizationId),
  }
  if (cycleId) query.cycleId = oid(cycleId)
  const docs = await CalibrationSessionModel.find(query).sort({ createdAt: -1 }).lean()
  return (docs as LeanDoc[]).map((d) => ({
    id: sid(d._id),
    cycleId: sid(d.cycleId),
    name: sid(d.name),
    status: sid(d.status),
  }))
}

export async function insertPip(data: Record<string, unknown>) {
  const doc = await PerformanceImprovementPlanModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    legalEntityId: data.legalEntityId ? oid(String(data.legalEntityId)) : undefined,
    branchId: data.branchId ? oid(String(data.branchId)) : undefined,
    employeeId: oid(String(data.employeeId)),
    managerEmployeeId: data.managerEmployeeId ? oid(String(data.managerEmployeeId)) : undefined,
    reviewId: data.reviewId ? oid(String(data.reviewId)) : undefined,
    createdBy: oid(String(data.createdBy)),
  })
  return {
    id: sid(doc._id),
    organizationId: sid(doc.organizationId),
    employeeId: sid(doc.employeeId),
    status: sid(doc.status),
    startDate: doc.startDate,
    endDate: doc.endDate,
    reason: sid(doc.reason),
  }
}

export async function findPipById(id: string) {
  const doc = await PerformanceImprovementPlanModel.findById(oid(id)).lean()
  if (!doc) return null
  const d = doc as LeanDoc
  return {
    id: sid(d._id),
    organizationId: sid(d.organizationId),
    branchId: d.branchId ? sid(d.branchId) : undefined,
    employeeId: sid(d.employeeId),
    managerEmployeeId: d.managerEmployeeId ? sid(d.managerEmployeeId) : undefined,
    status: sid(d.status),
    startDate: d.startDate as Date,
    endDate: d.endDate as Date,
    reason: sid(d.reason),
    concerns: d.concerns ? sid(d.concerns) : undefined,
    expectations: d.expectations ? sid(d.expectations) : undefined,
    goals: d.goals,
    checkIns: d.checkIns,
    outcome: d.outcome ? sid(d.outcome) : undefined,
  }
}

export async function updatePip(id: string, patch: Record<string, unknown>) {
  if (patch.updatedBy) patch.updatedBy = oid(String(patch.updatedBy))
  const doc = await PerformanceImprovementPlanModel.findByIdAndUpdate(
    oid(id),
    { $set: patch },
    { new: true },
  ).lean()
  return doc ? findPipById(id) : null
}

export async function listPips(filter: {
  organizationId: string
  employeeId?: string
  status?: string
  branchIds?: string[]
  skip: number
  limit: number
}) {
  const query: FilterQuery<typeof PerformanceImprovementPlanModel> = {
    organizationId: oid(filter.organizationId),
  }
  if (filter.employeeId) query.employeeId = oid(filter.employeeId)
  if (filter.status) query.status = filter.status
  if (filter.branchIds?.length) query.branchId = { $in: filter.branchIds.map((id) => oid(id)) }
  const [items, total] = await Promise.all([
    PerformanceImprovementPlanModel.find(query)
      .sort({ startDate: -1 })
      .skip(filter.skip)
      .limit(filter.limit)
      .lean(),
    PerformanceImprovementPlanModel.countDocuments(query),
  ])
  return {
    items: (items as LeanDoc[]).map((d) => ({
      id: sid(d._id),
      employeeId: sid(d.employeeId),
      status: sid(d.status),
      startDate: d.startDate as Date,
      endDate: d.endDate as Date,
      reason: sid(d.reason),
    })),
    total,
  }
}

export async function insertOneOnOne(data: Record<string, unknown>) {
  const doc = await OneOnOneModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    employeeId: oid(String(data.employeeId)),
    managerEmployeeId: oid(String(data.managerEmployeeId)),
    createdBy: oid(String(data.createdBy)),
  })
  return {
    id: sid(doc._id),
    employeeId: sid(doc.employeeId),
    managerEmployeeId: sid(doc.managerEmployeeId),
    scheduledAt: doc.scheduledAt,
    status: sid(doc.status),
  }
}

export async function listOneOnOnes(filter: {
  organizationId: string
  employeeId?: string
  managerEmployeeId?: string
  skip: number
  limit: number
}) {
  const query: FilterQuery<typeof OneOnOneModel> = {
    organizationId: oid(filter.organizationId),
  }
  if (filter.employeeId) query.employeeId = oid(filter.employeeId)
  if (filter.managerEmployeeId) query.managerEmployeeId = oid(filter.managerEmployeeId)
  const [items, total] = await Promise.all([
    OneOnOneModel.find(query).sort({ scheduledAt: -1 }).skip(filter.skip).limit(filter.limit).lean(),
    OneOnOneModel.countDocuments(query),
  ])
  return {
    items: (items as LeanDoc[]).map((d) => ({
      id: sid(d._id),
      employeeId: sid(d.employeeId),
      managerEmployeeId: sid(d.managerEmployeeId),
      scheduledAt: d.scheduledAt as Date,
      status: sid(d.status),
      agenda: d.agenda ? sid(d.agenda) : undefined,
      sharedNotes: d.sharedNotes ? sid(d.sharedNotes) : undefined,
      privateManagerNotes: d.privateManagerNotes ? sid(d.privateManagerNotes) : undefined,
      actionItems: d.actionItems,
    })),
    total,
  }
}

export async function insertFeedback(data: Record<string, unknown>) {
  const doc = await ContinuousFeedbackModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    senderUserId: oid(String(data.senderUserId)),
    recipientEmployeeId: oid(String(data.recipientEmployeeId)),
    relatedGoalId: data.relatedGoalId ? oid(String(data.relatedGoalId)) : undefined,
    relatedReviewId: data.relatedReviewId ? oid(String(data.relatedReviewId)) : undefined,
  })
  return {
    id: sid(doc._id),
    recipientEmployeeId: sid(doc.recipientEmployeeId),
    feedbackType: sid(doc.feedbackType),
    message: sid(doc.message),
    visibility: sid(doc.visibility),
  }
}

export async function listFeedback(filter: {
  organizationId: string
  recipientEmployeeId?: string
  skip: number
  limit: number
}) {
  const query: FilterQuery<typeof ContinuousFeedbackModel> = {
    organizationId: oid(filter.organizationId),
  }
  if (filter.recipientEmployeeId) query.recipientEmployeeId = oid(filter.recipientEmployeeId)
  const [items, total] = await Promise.all([
    ContinuousFeedbackModel.find(query)
      .sort({ createdAt: -1 })
      .skip(filter.skip)
      .limit(filter.limit)
      .lean(),
    ContinuousFeedbackModel.countDocuments(query),
  ])
  return {
    items: (items as LeanDoc[]).map((d) => ({
      id: sid(d._id),
      recipientEmployeeId: sid(d.recipientEmployeeId),
      senderUserId: sid(d.senderUserId),
      feedbackType: sid(d.feedbackType),
      message: sid(d.message),
      visibility: sid(d.visibility),
      createdAt: d.createdAt as Date,
    })),
    total,
  }
}

export async function insertRecognition(data: Record<string, unknown>) {
  const doc = await RecognitionModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    employeeId: oid(String(data.employeeId)),
    recognizerUserId: oid(String(data.recognizerUserId)),
  })
  return {
    id: sid(doc._id),
    employeeId: sid(doc.employeeId),
    message: sid(doc.message),
    visibility: sid(doc.visibility),
  }
}

export async function listRecognitions(filter: {
  organizationId: string
  employeeId?: string
  skip: number
  limit: number
}) {
  const query: FilterQuery<typeof RecognitionModel> = {
    organizationId: oid(filter.organizationId),
  }
  if (filter.employeeId) query.employeeId = oid(filter.employeeId)
  const [items, total] = await Promise.all([
    RecognitionModel.find(query).sort({ createdAt: -1 }).skip(filter.skip).limit(filter.limit).lean(),
    RecognitionModel.countDocuments(query),
  ])
  return {
    items: (items as LeanDoc[]).map((d) => ({
      id: sid(d._id),
      employeeId: sid(d.employeeId),
      message: sid(d.message),
      category: d.category ? sid(d.category) : undefined,
      visibility: sid(d.visibility),
      createdAt: d.createdAt as Date,
    })),
    total,
  }
}

export async function insertDevelopmentPlan(data: Record<string, unknown>) {
  const doc = await DevelopmentPlanModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    employeeId: oid(String(data.employeeId)),
    reviewId: data.reviewId ? oid(String(data.reviewId)) : undefined,
    ownerEmployeeId: data.ownerEmployeeId ? oid(String(data.ownerEmployeeId)) : undefined,
    createdBy: oid(String(data.createdBy)),
  })
  return {
    id: sid(doc._id),
    employeeId: sid(doc.employeeId),
    objective: sid(doc.objective),
    status: sid(doc.status),
  }
}

export async function listDevelopmentPlans(filter: {
  organizationId: string
  employeeId?: string
  skip: number
  limit: number
}) {
  const query: FilterQuery<typeof DevelopmentPlanModel> = {
    organizationId: oid(filter.organizationId),
  }
  if (filter.employeeId) query.employeeId = oid(filter.employeeId)
  const [items, total] = await Promise.all([
    DevelopmentPlanModel.find(query)
      .sort({ updatedAt: -1 })
      .skip(filter.skip)
      .limit(filter.limit)
      .lean(),
    DevelopmentPlanModel.countDocuments(query),
  ])
  return {
    items: (items as LeanDoc[]).map((d) => ({
      id: sid(d._id),
      employeeId: sid(d.employeeId),
      objective: sid(d.objective),
      status: sid(d.status),
      progressPercent: sid(d.progressPercent ?? '0.00'),
      actions: d.actions,
    })),
    total,
  }
}

export async function insertTrainingRecommendation(data: Record<string, unknown>) {
  const doc = await TrainingRecommendationModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    employeeId: oid(String(data.employeeId)),
    reviewId: data.reviewId ? oid(String(data.reviewId)) : undefined,
    recommendedBy: oid(String(data.recommendedBy)),
  })
  return {
    id: sid(doc._id),
    employeeId: sid(doc.employeeId),
    topic: sid(doc.topic),
    status: sid(doc.status),
  }
}

export async function insertSuccessionPlan(data: Record<string, unknown>) {
  const doc = await SuccessionPlanModel.create({
    ...data,
    organizationId: oid(String(data.organizationId)),
    legalEntityId: data.legalEntityId ? oid(String(data.legalEntityId)) : undefined,
    branchId: data.branchId ? oid(String(data.branchId)) : undefined,
    criticalPositionId: data.criticalPositionId ? oid(String(data.criticalPositionId)) : undefined,
    createdBy: oid(String(data.createdBy)),
    candidates: ((data.candidates as Array<Record<string, unknown>>) ?? []).map((c) => ({
      ...c,
      employeeId: oid(String(c.employeeId)),
      developmentPlanId: c.developmentPlanId ? oid(String(c.developmentPlanId)) : undefined,
    })),
  })
  return {
    id: sid(doc._id),
    criticalPositionTitle: sid(doc.criticalPositionTitle),
    status: sid(doc.status),
    candidates: doc.candidates,
  }
}

export async function listSuccessionPlans(organizationId: string) {
  const docs = await SuccessionPlanModel.find({
    organizationId: oid(organizationId),
    status: 'ACTIVE',
  })
    .sort({ updatedAt: -1 })
    .lean()
  return (docs as LeanDoc[]).map((d) => ({
    id: sid(d._id),
    criticalPositionTitle: sid(d.criticalPositionTitle),
    status: sid(d.status),
    candidates: d.candidates,
  }))
}

export async function countByStatus(
  collection:
    | 'performance_cycles'
    | 'performance_reviews'
    | 'employee_goals'
    | 'performance_improvement_plans'
    | 'development_plans',
  organizationId: string,
  branchIds?: string[],
) {
  const modelMap = {
    performance_cycles: PerformanceCycleModel,
    performance_reviews: PerformanceReviewModel,
    employee_goals: EmployeeGoalModel,
    performance_improvement_plans: PerformanceImprovementPlanModel,
    development_plans: DevelopmentPlanModel,
  } as const
  const Model = modelMap[collection]
  const match: Record<string, unknown> = { organizationId: oid(organizationId) }
  if (branchIds?.length && collection !== 'performance_cycles' && collection !== 'development_plans') {
    match.branchId = { $in: branchIds.map((id) => oid(id)) }
  }
  const rows = await Model.aggregate([
    { $match: match },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ])
  const result: Record<string, number> = {}
  for (const row of rows) result[String(row._id)] = Number(row.count)
  return result
}

export async function ratingDistribution(organizationId: string, cycleId?: string) {
  const match: Record<string, unknown> = {
    organizationId: oid(organizationId),
    status: { $in: ['APPROVED', 'COMPLETED'] },
    finalRating: { $ne: null },
  }
  if (cycleId) match.cycleId = oid(cycleId)
  const rows = await PerformanceReviewModel.aggregate([
    { $match: match },
    { $group: { _id: '$finalRating', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ])
  return rows.map((r) => ({ rating: Number(r._id), count: Number(r.count) }))
}
