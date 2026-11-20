import {
  CHARGE_SOURCES,
  IMPORT_BATCH_STATUSES,
  IMPORT_ROW_RESULTS,
  TOLL_PROVIDERS,
} from '../../constants/charges.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import {
  allocateChargeNumber,
  findFineByExternal,
  findImportBatchById,
  findTollByExternal,
  insertImportBatch,
  insertImportRow,
  listImportBatches,
  listImportRows,
  updateImportBatch,
} from '../../repositories/charges/charges.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { isMoneyString, normalizeMoney } from '../../utils/money.js'
import { invalidField, notFound } from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import { assertPermission, hasBranchAccess, hasPermission } from '../authorization/authorization.service.js'
import { loadAccessibleImportBatch, resolveChargeOrganization } from './charges-access.js'
import { toImportBatchResource } from './charges.mapper.js'
import { createFine } from './fine.service.js'
import { createToll } from './toll.service.js'

export type ImportRowInput = {
  externalReference: string
  vehicleRegistration?: string
  vehicleId?: string
  eventAt: string
  amount: string
  currency?: string
  type?: string
  provider?: string
  location?: string
  description?: string
  gate?: string
}

type CreateImportBody = {
  organizationId?: string
  legalEntityId: string
  branchId: string
  kind: 'fine' | 'toll'
  provider: string
  fileName?: string
  rows: ImportRowInput[]
}

export async function listImportDirectory(ctx: AccessContext, query: Record<string, unknown>) {
  assertPermission(ctx, PERMISSIONS.FINE_IMPORT_VIEW)
  const organizationId = resolveChargeOrganization(ctx, query.organizationId as string | undefined)
  const pagination = resolvePagination(query)
  const page = await listImportBatches({
    organizationId,
    skip: pagination.skip,
    take: pagination.take,
    status: query.status ? (String(query.status).toUpperCase() as (typeof IMPORT_BATCH_STATUSES)[keyof typeof IMPORT_BATCH_STATUSES]) : undefined,
  })
  return toPaginated(
    page.items.map((row) => toImportBatchResource(row as Record<string, unknown>)),
    pagination.page,
    pagination.limit,
    page.total,
  )
}

export async function getImportBatch(ctx: AccessContext, id: string) {
  if (!hasPermission(ctx, PERMISSIONS.FINE_IMPORT_VIEW) && !hasPermission(ctx, PERMISSIONS.FINE_IMPORT_PROCESS)) {
    assertPermission(ctx, PERMISSIONS.FINE_IMPORT_VIEW)
  }
  const batch = await loadAccessibleImportBatch(ctx, id)
  const rows = await listImportRows(id)
  return {
    ...toImportBatchResource(batch as Record<string, unknown>),
    rows: rows.map((row) => ({
      id: String(row._id),
      rowNumber: Number(row.rowNumber),
      result: String(row.result).toLowerCase(),
      externalReference: row.externalReference ? String(row.externalReference) : undefined,
      reason: row.reason ? String(row.reason) : undefined,
      createdRecordId: row.createdRecordId ? String(row.createdRecordId) : undefined,
      existingRecordId: row.existingRecordId ? String(row.existingRecordId) : undefined,
    })),
  }
}

export async function processImport(ctx: AccessContext, body: CreateImportBody, meta: RequestMeta) {
  assertPermission(ctx, PERMISSIONS.FINE_IMPORT_PROCESS)
  const organizationId = resolveChargeOrganization(ctx, body.organizationId)
  if (!hasBranchAccess(ctx, body.branchId, organizationId)) throw notFound('Branch was not found.')
  if (!body.rows?.length) throw invalidField('rows', 'At least one import row is required.')
  if (body.rows.length > 5000) throw invalidField('rows', 'Import is limited to 5000 rows per batch.')

  const kind = body.kind.toUpperCase() === 'TOLL' ? 'TOLL' : 'FINE'
  const provider = body.provider.trim().toUpperCase()
  const documentNumber = await allocateChargeNumber(organizationId, 'import')
  const batch = await insertImportBatch({
    organizationId,
    legalEntityId: body.legalEntityId,
    branchId: body.branchId,
    documentNumber,
    provider,
    kind,
    fileName: body.fileName,
    status: IMPORT_BATCH_STATUSES.PROCESSING,
    totalRows: body.rows.length,
    successRows: 0,
    duplicateRows: 0,
    failedRows: 0,
    reviewRows: 0,
    createdBy: ctx.userId,
  })

  let successRows = 0
  let duplicateRows = 0
  let failedRows = 0
  let reviewRows = 0
  const errors: string[] = []

  for (let index = 0; index < body.rows.length; index += 1) {
    const row = body.rows[index]!
    const rowNumber = index + 1
    try {
      if (!row.externalReference?.trim()) throw new Error('externalReference is required')
      if (!row.eventAt) throw new Error('eventAt is required')
      if (!row.amount || !isMoneyString(row.amount)) throw new Error('amount is invalid')
      const eventAt = new Date(row.eventAt)
      if (Number.isNaN(eventAt.getTime())) throw new Error('eventAt is invalid')

      if (kind === 'FINE') {
        const existing = await findFineByExternal(organizationId, provider, row.externalReference.trim())
        if (existing) {
          duplicateRows += 1
          await insertImportRow({
            batchId: String(batch._id),
            organizationId,
            rowNumber,
            result: IMPORT_ROW_RESULTS.DUPLICATE,
            externalReference: row.externalReference,
            reason: 'Duplicate external reference',
            existingRecordId: existing.id,
            payload: row,
          })
          continue
        }
        const created = await createFine(
          ctx,
          {
            organizationId,
            legalEntityId: body.legalEntityId,
            branchId: body.branchId,
            externalReference: row.externalReference,
            provider,
            fineType: (row.type ?? 'OTHER').toLowerCase(),
            source: CHARGE_SOURCES.IMPORT.toLowerCase(),
            eventAt,
            vehicleId: row.vehicleId,
            vehiclePlate: row.vehicleRegistration,
            amount: normalizeMoney(row.amount),
            currency: row.currency,
            location: row.location,
            description: row.description,
          },
          meta,
        )
        const needsReview = created.assignmentResolution !== 'assigned'
        if (needsReview) reviewRows += 1
        else successRows += 1
        await insertImportRow({
          batchId: String(batch._id),
          organizationId,
          rowNumber,
          result: needsReview ? IMPORT_ROW_RESULTS.REVIEW_REQUIRED : IMPORT_ROW_RESULTS.CREATED,
          externalReference: row.externalReference,
          createdRecordId: created.id,
          payload: row,
        })
      } else {
        const tollProvider = (row.provider ?? provider).toUpperCase()
        if (!(Object.values(TOLL_PROVIDERS) as string[]).includes(tollProvider)) {
          throw new Error('Unsupported toll provider')
        }
        const existing = await findTollByExternal(organizationId, tollProvider, row.externalReference.trim())
        if (existing) {
          duplicateRows += 1
          await insertImportRow({
            batchId: String(batch._id),
            organizationId,
            rowNumber,
            result: IMPORT_ROW_RESULTS.DUPLICATE,
            externalReference: row.externalReference,
            reason: 'Duplicate external reference',
            existingRecordId: existing.id,
            payload: row,
          })
          continue
        }
        const created = await createToll(
          ctx,
          {
            organizationId,
            legalEntityId: body.legalEntityId,
            branchId: body.branchId,
            externalReference: row.externalReference,
            provider: tollProvider.toLowerCase(),
            source: CHARGE_SOURCES.IMPORT.toLowerCase(),
            eventAt,
            vehicleId: row.vehicleId,
            vehiclePlate: row.vehicleRegistration,
            amount: normalizeMoney(row.amount),
            currency: row.currency,
            location: row.location,
            gate: row.gate,
            description: row.description,
          },
          meta,
        )
        const needsReview = created.assignmentResolution !== 'assigned'
        if (needsReview) reviewRows += 1
        else successRows += 1
        await insertImportRow({
          batchId: String(batch._id),
          organizationId,
          rowNumber,
          result: needsReview ? IMPORT_ROW_RESULTS.REVIEW_REQUIRED : IMPORT_ROW_RESULTS.CREATED,
          externalReference: row.externalReference,
          createdRecordId: created.id,
          payload: row,
        })
      }
    } catch (error) {
      failedRows += 1
      const reason = error instanceof Error ? error.message : 'Invalid row'
      errors.push(`Row ${rowNumber}: ${reason}`)
      await insertImportRow({
        batchId: String(batch._id),
        organizationId,
        rowNumber,
        result: IMPORT_ROW_RESULTS.INVALID,
        externalReference: row.externalReference,
        reason,
        payload: row,
      })
    }
  }

  const status =
    failedRows === 0
      ? IMPORT_BATCH_STATUSES.COMPLETED
      : successRows + duplicateRows + reviewRows > 0
        ? IMPORT_BATCH_STATUSES.COMPLETED_WITH_ERRORS
        : IMPORT_BATCH_STATUSES.FAILED

  const updated = await updateImportBatch(String(batch._id), {
    status,
    successRows,
    duplicateRows,
    failedRows,
    reviewRows,
    errorSummary: errors.slice(0, 20).join('\n'),
    completedAt: new Date(),
  })

  await recordAuditEvent({
    action: AUDIT_ACTIONS.FINE_IMPORT_PROCESS,
    entityType: AUDIT_ENTITY_TYPES.FINE_IMPORT,
    entityId: String(batch._id),
    actorUserId: ctx.userId,
    organizationId,
    branchId: body.branchId,
    metadata: { successRows, duplicateRows, failedRows, reviewRows, kind },
    meta,
  })

  return getImportBatch(ctx, String((updated ?? batch)._id))
}

export async function getImportBatchRaw(ctx: AccessContext, id: string) {
  assertPermission(ctx, PERMISSIONS.FINE_IMPORT_VIEW)
  const batch = await findImportBatchById(id)
  if (!batch) throw notFound('Import batch was not found.')
  return loadAccessibleImportBatch(ctx, id)
}
