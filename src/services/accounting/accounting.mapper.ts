import { toPublicEnum } from '../../constants/vehicles.js'
import type {
  FiscalPeriodRecord,
  FiscalYearRecord,
  GlAccountRecord,
  JournalLineRecord,
  JournalRecord,
} from '../../repositories/accounting/accounting.repository.js'

function iso(value?: Date) {
  return value ? value.toISOString() : undefined
}

export function toAccountResource(account: GlAccountRecord) {
  return {
    id: account.id,
    organizationId: account.organizationId,
    legalEntityId: account.legalEntityId,
    code: account.code,
    name: account.name,
    accountType: toPublicEnum(account.accountType),
    normalBalance: toPublicEnum(account.normalBalance),
    parentAccountId: account.parentAccountId,
    description: account.description,
    currency: account.currency,
    isSystem: account.isSystem,
    systemRole: account.systemRole ? toPublicEnum(account.systemRole) : undefined,
    isActive: account.isActive,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  }
}

export function toJournalResource(journal: JournalRecord) {
  return {
    id: journal.id,
    organizationId: journal.organizationId,
    legalEntityId: journal.legalEntityId,
    branchId: journal.branchId,
    journalNumber: journal.journalNumber,
    journalType: toPublicEnum(journal.journalType),
    accountingDate: journal.accountingDate.toISOString(),
    postingDate: iso(journal.postingDate),
    description: journal.description,
    reference: journal.reference,
    sourceModule: toPublicEnum(journal.sourceModule),
    sourceType: journal.sourceType ? toPublicEnum(journal.sourceType) : undefined,
    sourceId: journal.sourceId,
    fiscalPeriodId: journal.fiscalPeriodId,
    status: toPublicEnum(journal.status),
    currency: journal.currency,
    totalDebit: journal.totalDebit,
    totalCredit: journal.totalCredit,
    postedAt: iso(journal.postedAt),
    postedBy: journal.postedBy,
    reversedJournalId: journal.reversedJournalId,
    reversalOfJournalId: journal.reversalOfJournalId,
    reversalReason: journal.reversalReason,
    createdAt: journal.createdAt.toISOString(),
    updatedAt: journal.updatedAt.toISOString(),
  }
}

export function toJournalLineResource(line: JournalLineRecord) {
  return {
    id: line.id,
    journalId: line.journalId,
    lineNumber: line.lineNumber,
    accountId: line.accountId,
    accountCode: line.accountCode,
    accountName: line.accountName,
    debit: line.debit,
    credit: line.credit,
    description: line.description,
    branchId: line.branchId,
    customerId: line.customerId,
    vendorId: line.vendorId,
    vehicleId: line.vehicleId,
    contractId: line.contractId,
    invoiceId: line.invoiceId,
    paymentId: line.paymentId,
    reference: line.reference,
  }
}

export function toFiscalYearResource(year: FiscalYearRecord) {
  return {
    id: year.id,
    organizationId: year.organizationId,
    legalEntityId: year.legalEntityId,
    name: year.name,
    startDate: year.startDate.toISOString(),
    endDate: year.endDate.toISOString(),
    status: toPublicEnum(year.status),
    createdAt: year.createdAt.toISOString(),
  }
}

export function toFiscalPeriodResource(period: FiscalPeriodRecord) {
  return {
    id: period.id,
    organizationId: period.organizationId,
    legalEntityId: period.legalEntityId,
    fiscalYearId: period.fiscalYearId,
    name: period.name,
    periodNumber: period.periodNumber,
    startDate: period.startDate.toISOString(),
    endDate: period.endDate.toISOString(),
    status: toPublicEnum(period.status),
    closedAt: iso(period.closedAt),
    closeReason: period.closeReason,
    reopenedAt: iso(period.reopenedAt),
    reopenReason: period.reopenReason,
    createdAt: period.createdAt.toISOString(),
  }
}
