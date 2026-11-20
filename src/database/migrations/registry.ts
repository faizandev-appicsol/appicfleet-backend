import { migration001FoundationIndexes } from './001_foundation_indexes.js'
import { migration002TenancyRbac } from './002_tenancy_rbac.js'
import { migration003Vehicles } from './003_vehicles.js'
import { migration004Customers } from './004_customers.js'
import { migration005Bookings } from './005_bookings.js'
import { migration006Contracts } from './006_contracts.js'
import { migration007Finance } from './007_finance.js'
import { migration008Procurement } from './008_procurement.js'
import { migration009Charges } from './009_charges.js'
import { migration010Accounting } from './010_accounting.js'
import { migration011TaxEinvoicing } from './011_tax_einvoicing.js'
import { migration012Reporting } from './012_reporting.js'
import { migration013Investors } from './013_investors.js'
import { migration014Hr } from './014_hr.js'
import { migration015Payroll } from './015_payroll.js'
import { migration016Workforce } from './016_workforce.js'
import { migration017Recruitment } from './017_recruitment.js'
import { migration018Performance } from './018_performance.js'
import { migration019VehicleMakes } from './019_vehicle_makes.js'
import { migration020VehicleTypes } from './020_vehicle_types.js'
import { migration021VehicleSoftDelete } from './021_vehicle_soft_delete.js'
import type { MigrationDefinition } from './types.js'

/**
 * Ordered list of MongoDB migrations.
 * Append new files and register them here. Never reorder applied ids.
 */
export const migrations: readonly MigrationDefinition[] = [
  migration001FoundationIndexes,
  migration002TenancyRbac,
  migration003Vehicles,
  migration004Customers,
  migration005Bookings,
  migration006Contracts,
  migration007Finance,
  migration008Procurement,
  migration009Charges,
  migration010Accounting,
  migration011TaxEinvoicing,
  migration012Reporting,
  migration013Investors,
  migration014Hr,
  migration015Payroll,
  migration016Workforce,
  migration017Recruitment,
  migration018Performance,
  migration019VehicleMakes,
  migration020VehicleTypes,
  migration021VehicleSoftDelete,
]
