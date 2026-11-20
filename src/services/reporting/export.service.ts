import type { AccessContext } from '../../types/access.js'
import { assertExportAccess } from './reporting-access.js'
import {
  getBookingReport,
  getContractReport,
  getCustomerReport,
  getExpenseReport,
  getFinesReport,
  getMaintenanceReport,
  getPaymentReport,
  getRefundsReport,
  getVehicleReport,
} from './report.service.js'

export type ReportExportKind =
  | 'bookings'
  | 'vehicles'
  | 'customers'
  | 'contracts'
  | 'payments'
  | 'expenses'
  | 'maintenance'
  | 'fines'
  | 'refunds'

function csvEscape(value: unknown): string {
  const text = value == null ? '' : String(value)
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function toCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','))
  }
  return `${lines.join('\n')}\n`
}

/**
 * Synchronous CSV export for the current page (max 100 rows via pagination).
 * Large async/background exports are not implemented yet — callers must page.
 */
export async function exportReportCsv(
  ctx: AccessContext,
  kind: ReportExportKind,
  query: Record<string, unknown>,
): Promise<{ filename: string; contentType: string; body: string }> {
  assertExportAccess(ctx)
  const pageQuery = { ...query, page: 1, pageSize: 100, limit: 100 }

  switch (kind) {
    case 'bookings': {
      const data = await getBookingReport(ctx, pageQuery as never)
      const headers = [
        'bookingNumber',
        'customerName',
        'vehiclePlate',
        'status',
        'startsAt',
        'endsAt',
        'estimatedAmount',
        'currency',
        'branchId',
      ]
      return {
        filename: 'bookings-report.csv',
        contentType: 'text/csv; charset=utf-8',
        body: toCsv(headers, data.items as Array<Record<string, unknown>>),
      }
    }
    case 'vehicles': {
      const data = await getVehicleReport(ctx, pageQuery as never)
      const headers = [
        'plateNumber',
        'make',
        'model',
        'category',
        'status',
        'currentContractNumber',
        'currentCustomerName',
        'branchId',
      ]
      return {
        filename: 'vehicles-report.csv',
        contentType: 'text/csv; charset=utf-8',
        body: toCsv(headers, data.items as Array<Record<string, unknown>>),
      }
    }
    case 'customers': {
      const data = await getCustomerReport(ctx, pageQuery as never)
      const headers = [
        'customerNumber',
        'displayName',
        'type',
        'activeContracts',
        'totalBookings',
        'totalInvoiced',
        'totalPaid',
        'outstandingBalance',
      ]
      return {
        filename: 'customers-report.csv',
        contentType: 'text/csv; charset=utf-8',
        body: toCsv(headers, data.items as Array<Record<string, unknown>>),
      }
    }
    case 'contracts': {
      const data = await getContractReport(ctx, pageQuery as never)
      const headers = [
        'contractNumber',
        'customerName',
        'vehiclePlate',
        'status',
        'startsAt',
        'endsAt',
        'outstandingBalance',
        'branchId',
      ]
      return {
        filename: 'contracts-report.csv',
        contentType: 'text/csv; charset=utf-8',
        body: toCsv(headers, data.items as Array<Record<string, unknown>>),
      }
    }
    case 'payments': {
      const data = await getPaymentReport(ctx, pageQuery as never)
      const headers = [
        'paymentNumber',
        'customerName',
        'amount',
        'currency',
        'method',
        'status',
        'paymentDate',
        'branchId',
      ]
      return {
        filename: 'payments-report.csv',
        contentType: 'text/csv; charset=utf-8',
        body: toCsv(headers, data.items as Array<Record<string, unknown>>),
      }
    }
    case 'expenses': {
      const data = await getExpenseReport(ctx, pageQuery as never)
      const headers = [
        'expenseNumber',
        'vendorName',
        'category',
        'amount',
        'currency',
        'expenseDate',
        'status',
        'branchId',
      ]
      return {
        filename: 'expenses-report.csv',
        contentType: 'text/csv; charset=utf-8',
        body: toCsv(headers, data.items as Array<Record<string, unknown>>),
      }
    }
    case 'maintenance': {
      const data = await getMaintenanceReport(ctx, pageQuery as never)
      const headers = [
        'workOrderNumber',
        'vehiclePlate',
        'vendorName',
        'maintenanceType',
        'cost',
        'currency',
        'scheduledAt',
        'status',
      ]
      return {
        filename: 'maintenance-report.csv',
        contentType: 'text/csv; charset=utf-8',
        body: toCsv(headers, data.items as Array<Record<string, unknown>>),
      }
    }
    case 'fines': {
      const data = await getFinesReport(ctx, pageQuery as never)
      const headers = [
        'kind',
        'number',
        'vehiclePlate',
        'eventAt',
        'amount',
        'currency',
        'recoveryStatus',
        'branchId',
      ]
      return {
        filename: 'fines-tolls-report.csv',
        contentType: 'text/csv; charset=utf-8',
        body: toCsv(headers, data.items as Array<Record<string, unknown>>),
      }
    }
    case 'refunds': {
      const data = await getRefundsReport(ctx, pageQuery as never)
      const headers = [
        'refundNumber',
        'customerName',
        'source',
        'amount',
        'currency',
        'status',
        'createdAt',
        'branchId',
      ]
      return {
        filename: 'refunds-report.csv',
        contentType: 'text/csv; charset=utf-8',
        body: toCsv(headers, data.items as Array<Record<string, unknown>>),
      }
    }
    default:
      return {
        filename: 'report.csv',
        contentType: 'text/csv; charset=utf-8',
        body: 'unsupported\n',
      }
  }
}
