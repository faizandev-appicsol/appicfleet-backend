import { Types } from 'mongoose'
import {
  EInvoiceDocument,
  EInvoiceSubmission,
  TaxCode,
  TaxConfiguration,
  TaxPeriod,
  TaxRate,
  TaxStatusEvent,
  TaxTransaction,
} from '../../models/tax.model.js'

function id(value: Types.ObjectId | string) {
  return String(value)
}

function mapDoc<T extends { _id: Types.ObjectId }>(doc: T) {
  const { _id, ...rest } = doc as T & { __v?: number }
  return { id: id(_id), ...rest }
}

export async function insertTaxCode(input: Record<string, unknown>) {
  const created = await TaxCode.create(input)
  return mapDoc(created.toObject())
}

export async function updateTaxCode(taxCodeId: string, patch: Record<string, unknown>) {
  const updated = await TaxCode.findByIdAndUpdate(taxCodeId, { $set: patch }, { new: true }).lean()
  return updated ? mapDoc(updated) : null
}

export async function findTaxCodeById(taxCodeId: string) {
  const row = await TaxCode.findById(taxCodeId).lean()
  return row ? mapDoc(row) : null
}

export async function findTaxCodeByCode(organizationId: string, code: string) {
  const row = await TaxCode.findOne({ organizationId, code: code.toUpperCase() }).lean()
  return row ? mapDoc(row) : null
}

export async function listTaxCodes(filter: Record<string, unknown>, skip: number, take: number) {
  const [items, total] = await Promise.all([
    TaxCode.find(filter).sort({ code: 1 }).skip(skip).limit(take).lean(),
    TaxCode.countDocuments(filter),
  ])
  return { items: items.map(mapDoc), total }
}

export async function insertTaxRate(input: Record<string, unknown>) {
  const created = await TaxRate.create(input)
  return mapDoc(created.toObject())
}

export async function listTaxRates(taxCodeId: string) {
  const rows = await TaxRate.find({ taxCodeId }).sort({ effectiveFrom: -1 }).lean()
  return rows.map(mapDoc)
}

export async function findActiveTaxRate(organizationId: string, taxCodeId: string, at: Date) {
  const row = await TaxRate.findOne({
    organizationId,
    taxCodeId,
    effectiveFrom: { $lte: at },
    $or: [{ effectiveTo: null }, { effectiveTo: { $exists: false } }, { effectiveTo: { $gt: at } }],
  })
    .sort({ effectiveFrom: -1 })
    .lean()
  return row ? mapDoc(row) : null
}

export async function upsertTaxConfiguration(organizationId: string, legalEntityId: string, patch: Record<string, unknown>) {
  const updated = await TaxConfiguration.findOneAndUpdate(
    { organizationId, legalEntityId },
    { $set: { ...patch, organizationId, legalEntityId } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean()
  return updated ? mapDoc(updated) : null
}

export async function findTaxConfiguration(organizationId: string, legalEntityId: string) {
  const row = await TaxConfiguration.findOne({ organizationId, legalEntityId }).lean()
  return row ? mapDoc(row) : null
}

export async function insertTaxPeriod(input: Record<string, unknown>) {
  const created = await TaxPeriod.create(input)
  return mapDoc(created.toObject())
}

export async function findTaxPeriodById(idValue: string) {
  const row = await TaxPeriod.findById(idValue).lean()
  return row ? mapDoc(row) : null
}

export async function listTaxPeriods(filter: Record<string, unknown>) {
  const rows = await TaxPeriod.find(filter).sort({ taxYear: -1, periodNumber: -1 }).lean()
  return rows.map(mapDoc)
}

export async function findOpenTaxPeriodForDate(organizationId: string, legalEntityId: string, date: Date) {
  const row = await TaxPeriod.findOne({
    organizationId,
    legalEntityId,
    status: 'OPEN',
    startDate: { $lte: date },
    endDate: { $gte: date },
  }).lean()
  return row ? mapDoc(row) : null
}

export async function transitionTaxPeriod(
  periodId: string,
  fromStatus: string,
  toStatus: string,
  patch: Record<string, unknown>,
) {
  const updated = await TaxPeriod.findOneAndUpdate(
    { _id: periodId, status: fromStatus },
    { $set: { status: toStatus, ...patch } },
    { new: true },
  ).lean()
  return updated ? mapDoc(updated) : null
}

export async function insertTaxTransaction(input: Record<string, unknown>) {
  try {
    const created = await TaxTransaction.create(input)
    return mapDoc(created.toObject())
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      const existing = await TaxTransaction.findOne({
        organizationId: input.organizationId,
        idempotencyKey: input.idempotencyKey,
      }).lean()
      if (existing) return mapDoc(existing)
    }
    throw error
  }
}

export async function listTaxTransactions(filter: Record<string, unknown>, skip: number, take: number) {
  const [items, total] = await Promise.all([
    TaxTransaction.find(filter).sort({ transactionDate: -1, createdAt: -1 }).skip(skip).limit(take).lean(),
    TaxTransaction.countDocuments(filter),
  ])
  return { items: items.map(mapDoc), total }
}

export async function aggregateTaxReport(organizationId: string, legalEntityId: string, taxPeriodId?: string) {
  const match: Record<string, unknown> = { organizationId: new Types.ObjectId(organizationId), legalEntityId: new Types.ObjectId(legalEntityId) }
  if (taxPeriodId) match.taxPeriodId = new Types.ObjectId(taxPeriodId)
  const rows = await TaxTransaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: { taxCode: '$taxCode', taxTreatment: '$taxTreatment', sourceType: '$sourceType' },
        taxableAmount: { $sum: { $toDecimal: '$taxableAmount' } },
        taxAmount: { $sum: { $toDecimal: '$taxAmount' } },
        grossAmount: { $sum: { $toDecimal: '$grossAmount' } },
        count: { $sum: 1 },
      },
    },
  ])
  return rows.map((row) => ({
    taxCode: String(row._id.taxCode),
    taxTreatment: String(row._id.taxTreatment),
    sourceType: String(row._id.sourceType),
    taxableAmount: String(row.taxableAmount),
    taxAmount: String(row.taxAmount),
    grossAmount: String(row.grossAmount),
    count: row.count as number,
  }))
}

export async function insertEInvoiceDocument(input: Record<string, unknown>) {
  try {
    const created = await EInvoiceDocument.create(input)
    return mapDoc(created.toObject())
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      const existing = await EInvoiceDocument.findOne({
        organizationId: input.organizationId,
        submissionIdempotencyKey: input.submissionIdempotencyKey,
      }).lean()
      if (existing) return mapDoc(existing)
    }
    throw error
  }
}

export async function findEInvoiceById(idValue: string) {
  const row = await EInvoiceDocument.findById(idValue).lean()
  return row ? mapDoc(row) : null
}

export async function findEInvoiceBySource(
  organizationId: string,
  sourceType: string,
  sourceId: string,
  documentVersion?: number,
) {
  const filter: Record<string, unknown> = { organizationId, sourceType, sourceId }
  if (documentVersion !== undefined) filter.documentVersion = documentVersion
  const row = await EInvoiceDocument.findOne(filter).sort({ documentVersion: -1 }).lean()
  return row ? mapDoc(row) : null
}

export async function listEInvoices(filter: Record<string, unknown>, skip: number, take: number) {
  const [items, total] = await Promise.all([
    EInvoiceDocument.find(filter).sort({ issueDate: -1, createdAt: -1 }).skip(skip).limit(take).lean(),
    EInvoiceDocument.countDocuments(filter),
  ])
  return { items: items.map(mapDoc), total }
}

export async function transitionEInvoice(
  documentId: string,
  fromStatuses: string[],
  toStatus: string,
  patch: Record<string, unknown>,
) {
  const updated = await EInvoiceDocument.findOneAndUpdate(
    { _id: documentId, status: { $in: fromStatuses } },
    { $set: { status: toStatus, ...patch } },
    { new: true },
  ).lean()
  return updated ? mapDoc(updated) : null
}

export async function countEInvoicesByStatus(organizationId: string, legalEntityId?: string) {
  const match: Record<string, unknown> = { organizationId: new Types.ObjectId(organizationId) }
  if (legalEntityId) match.legalEntityId = new Types.ObjectId(legalEntityId)
  const rows = await EInvoiceDocument.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }])
  return Object.fromEntries(rows.map((row) => [String(row._id), row.count as number]))
}

export async function insertEInvoiceSubmission(input: Record<string, unknown>) {
  try {
    const created = await EInvoiceSubmission.create(input)
    return mapDoc(created.toObject())
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      const existing = await EInvoiceSubmission.findOne({
        organizationId: input.organizationId,
        requestIdempotencyKey: input.requestIdempotencyKey,
      }).lean()
      if (existing) return mapDoc(existing)
    }
    throw error
  }
}

export async function listEInvoiceSubmissions(einvoiceDocumentId: string) {
  const rows = await EInvoiceSubmission.find({ einvoiceDocumentId }).sort({ attemptNumber: 1 }).lean()
  return rows.map(mapDoc)
}

export async function countSubmissions(einvoiceDocumentId: string) {
  return EInvoiceSubmission.countDocuments({ einvoiceDocumentId })
}

export async function recordTaxStatusEvent(input: Record<string, unknown>) {
  const created = await TaxStatusEvent.create(input)
  return mapDoc(created.toObject())
}

export async function listTaxStatusEvents(entityType: string, entityId: string) {
  const rows = await TaxStatusEvent.find({ entityType, entityId }).sort({ createdAt: 1 }).lean()
  return rows.map(mapDoc)
}
