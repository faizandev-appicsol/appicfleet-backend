import { Router } from 'express'
import { appConfig } from '../config/app.config.js'
import { authRouter } from './auth.routes.js'
import { bookingRouter } from './booking.routes.js'
import { contractRouter } from './contract.routes.js'
import { branchRouter } from './branch.routes.js'
import { customerRouter } from './customer.routes.js'
import { docsRouter } from './docs.routes.js'
import {
  creditNoteRouter,
  debitNoteRouter,
  depositRouter,
  invoiceRouter,
  paymentRouter,
  receiptRouter,
} from './finance.routes.js'
import { healthRouter } from './health.routes.js'
import { legalEntityRouter } from './legal-entity.routes.js'
import { organizationRouter } from './organization.routes.js'
import { accountingRouter } from './accounting.routes.js'
import { taxRouter } from './tax.routes.js'
import { reportingRouter } from './reporting.routes.js'
import { investorPortalRouter, investorsAdminRouter } from './investor.routes.js'
import { hrRouter } from './hr.routes.js'
import { payrollRouter } from './payroll.routes.js'
import { performanceRouter } from './performance.routes.js'
import { recruitmentRouter } from './recruitment.routes.js'
import { workforceRouter } from './workforce.routes.js'
import {
  fineRouter,
  fineTollImportRouter,
  refundRouter,
  tollRouter,
} from './charges.routes.js'
import {
  apPaymentRouter,
  borrowCostRouter,
  expenseRouter,
  lpoRouter,
  serviceReminderRouter,
  vendorBillRouter,
  vendorRouter,
  workOrderRouter,
} from './procurement.routes.js'
import { permissionRouter, roleRouter } from './role.routes.js'
import { userRouter } from './user.routes.js'
import { vehicleRouter } from './vehicle.routes.js'

export const apiRouter = Router()

const v1 = Router()
v1.use('/health', healthRouter)
v1.use('/auth', authRouter)
v1.use('/users', userRouter)
v1.use('/organizations', organizationRouter)
v1.use('/legal-entities', legalEntityRouter)
v1.use('/branches', branchRouter)
v1.use('/roles', roleRouter)
v1.use('/permissions', permissionRouter)
v1.use('/vehicles', vehicleRouter)
v1.use('/customers', customerRouter)
v1.use('/bookings', bookingRouter)
v1.use('/contracts', contractRouter)
v1.use('/invoices', invoiceRouter)
v1.use('/payments', paymentRouter)
v1.use('/receipts', receiptRouter)
v1.use('/credit-notes', creditNoteRouter)
v1.use('/debit-notes', debitNoteRouter)
v1.use('/deposits', depositRouter)
v1.use('/vendors', vendorRouter)
v1.use('/lpos', lpoRouter)
v1.use('/vendor-bills', vendorBillRouter)
v1.use('/expenses', expenseRouter)
v1.use('/work-orders', workOrderRouter)
v1.use('/service-reminders', serviceReminderRouter)
v1.use('/borrow-costs', borrowCostRouter)
v1.use('/ap-payments', apPaymentRouter)
v1.use('/fines', fineRouter)
v1.use('/tolls', tollRouter)
v1.use('/fine-toll-imports', fineTollImportRouter)
v1.use('/refunds', refundRouter)
v1.use('/accounting', accountingRouter)
v1.use('/tax', taxRouter)
v1.use(reportingRouter)
v1.use('/investors', investorsAdminRouter)
v1.use('/investor', investorPortalRouter)
v1.use('/hr', hrRouter)
v1.use('/payroll', payrollRouter)
v1.use('/workforce', workforceRouter)
v1.use('/recruitment', recruitmentRouter)
v1.use('/performance', performanceRouter)
v1.use(docsRouter)

apiRouter.use(appConfig.apiPrefix, v1)
