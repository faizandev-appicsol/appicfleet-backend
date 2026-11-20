import { CUSTOMER_STATUSES, CUSTOMER_TYPES } from '../../constants/customers.js'
import { PERMISSIONS } from '../../constants/permissions.js'
import { ENTITY_STATUSES } from '../../constants/roles.js'
import { toPublicEnum } from '../../constants/vehicles.js'
import type { ICustomerCorporate, ICustomerIndividual } from '../../interfaces/customer.interface.js'
import { findBranchById } from '../../repositories/branches/branch.repository.js'
import {
  createCustomer,
  listCustomers,
  transitionCustomerStatus,
  updateCustomer,
  type CustomerUpdate,
} from '../../repositories/customers/customer.repository.js'
import { findLegalEntityById } from '../../repositories/legal-entities/legal-entity.repository.js'
import { findOrganizationById } from '../../repositories/organizations/organization.repository.js'
import type { AccessContext, RequestMeta } from '../../types/access.js'
import { conflict, invalidField, notFound } from '../../utils/httpErrors.js'
import { resolvePagination, toPaginated } from '../../utils/pagination.js'
import type {
  ChangeCustomerStatusBody,
  CreateCustomerBody,
  ListCustomersQuery,
  UpdateCustomerBody,
} from '../../validations/customer.validation.js'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, recordAuditEvent } from '../audit/audit.service.js'
import {
  assertBranchAccess,
  assertPermission,
  hasPermission,
} from '../authorization/authorization.service.js'
import { assertVehicleLegalEntityScope } from '../vehicles/vehicle-access.js'
import {
  canReveal,
  isOrganizationWide,
  loadAccessibleCustomer,
  resolveCustomerOrganization,
} from './customer-access.js'
import {
  buildDisplayName,
  normalizeEmail,
  normalizePhone,
  normalizeRegistration,
} from './customer-rules.js'
import {
  toCustomerListResource,
  toCustomerResource,
  type CustomerResource,
  type DuplicateReviewResource,
} from './customer.mapper.js'
import { detectDuplicates, matchKeysOf } from './duplicate.service.js'

/** Customer plus the potential duplicates found when it was saved (review only, nothing blocked). */
export type CustomerWithDuplicates = CustomerResource & {
  duplicateCandidates: DuplicateReviewResource[]
}

/** The branch must exist in the organization, be active, and be inside the caller's scope. */
async function resolveBranch(ctx: AccessContext, branchId: string, organizationId: string) {
  const branch = await findBranchById(branchId)
  if (!branch || branch.organizationId !== organizationId) {
    throw invalidField('branchId', 'Branch was not found in this organization')
  }
  if (branch.status !== ENTITY_STATUSES.ACTIVE) throw invalidField('branchId', 'Branch is not active')
  assertBranchAccess(ctx, branch.id, organizationId)
  return branch
}

export async function listCustomerDirectory(ctx: AccessContext, query: ListCustomersQuery) {
  const organizationId = resolveCustomerOrganization(ctx, query.organizationId)
  const pagination = resolvePagination(query)
  const orgWide = isOrganizationWide(ctx)

  // Branch isolation: branch-limited accounts only see their branches ($in) AND the requested filter.
  let branchIds: string[] | undefined = orgWide ? undefined : [...ctx.branchIds]
  if (query.branchId) {
    branchIds = branchIds ? branchIds.filter((id) => id === query.branchId) : [query.branchId]
  }
  // Legal-entity isolation, only for accounts that have assignments and are not organization-wide.
  const legalEntityIds = !orgWide && ctx.legalEntityIds.length > 0 ? [...ctx.legalEntityIds] : undefined

  const result = await listCustomers({
    organizationId,
    skip: pagination.skip,
    take: pagination.take,
    search: query.search?.trim() ? query.search.trim() : undefined,
    status: query.status,
    type: query.type,
    documentStatus: query.documentStatus,
    branchIds,
    legalEntityIds,
    sensitiveSearch: hasPermission(ctx, PERMISSIONS.CUSTOMER_VIEW_SENSITIVE),
    sort: query.sort ?? 'displayName',
    order: query.order ?? 'asc',
  })

  return toPaginated(
    result.items.map(toCustomerListResource),
    pagination.page,
    pagination.limit,
    result.total,
  )
}

export async function getCustomer(
  ctx: AccessContext,
  id: string,
  revealRequested?: boolean,
): Promise<CustomerResource> {
  const customer = await loadAccessibleCustomer(ctx, id)
  return toCustomerResource(customer, canReveal(ctx, revealRequested))
}

export async function addCustomer(
  ctx: AccessContext,
  input: CreateCustomerBody,
  meta: RequestMeta,
): Promise<CustomerWithDuplicates> {
  const organizationId = resolveCustomerOrganization(ctx, input.organizationId)
  if (ctx.accessAllOrganizations) {
    const organization = await findOrganizationById(organizationId)
    if (!organization) throw invalidField('organizationId', 'Organization was not found')
    if (organization.status !== ENTITY_STATUSES.ACTIVE) {
      throw invalidField('organizationId', 'Organization is not active')
    }
  }

  // The customer belongs to the branch's legal entity.
  const branch = await resolveBranch(ctx, input.branchId, organizationId)
  const legalEntity = await findLegalEntityById(branch.legalEntityId)
  if (!legalEntity || legalEntity.organizationId !== organizationId) {
    throw invalidField('branchId', 'The legal entity of this branch was not found')
  }
  assertVehicleLegalEntityScope(ctx, legalEntity.id, organizationId)

  const isIndividual = input.type === CUSTOMER_TYPES.INDIVIDUAL
  const individual: ICustomerIndividual | undefined = isIndividual ? input.individual : undefined
  const corporate: ICustomerCorporate | undefined = isIndividual
    ? undefined
    : input.corporate && {
        ...input.corporate,
        registrationNumber: normalizeRegistration(input.corporate.registrationNumber),
      }

  const displayName =
    input.displayName ??
    buildDisplayName({ type: input.type, individual, corporate })
  if (!displayName) throw invalidField('displayName', 'Enter a display name')

  const customer = await createCustomer({
    organizationId,
    legalEntityId: legalEntity.id,
    branchId: branch.id,
    type: input.type,
    displayName,
    email: input.email,
    phone: input.phone,
    alternatePhone: input.alternatePhone,
    address: input.address,
    notes: input.notes,
    individual,
    corporate,
    normalizedEmail: normalizeEmail(input.email),
    normalizedPhone: normalizePhone(input.phone),
    createdBy: ctx.userId,
  })

  const duplicateCandidates = await detectDuplicates(ctx, customer)

  await recordAuditEvent({
    action: AUDIT_ACTIONS.CUSTOMER_CREATE,
    entityType: AUDIT_ENTITY_TYPES.CUSTOMER,
    entityId: customer.id,
    actorUserId: ctx.userId,
    organizationId,
    branchId: customer.branchId,
    // Contact details and identity numbers are deliberately not logged.
    metadata: {
      customerNumber: customer.customerNumber,
      type: toPublicEnum(customer.type),
      legalEntityId: customer.legalEntityId,
      duplicateCandidateCount: duplicateCandidates.length,
    },
    meta,
  })
  return { ...toCustomerResource(customer, false), duplicateCandidates }
}

export async function changeCustomer(
  ctx: AccessContext,
  id: string,
  input: UpdateCustomerBody,
  meta: RequestMeta,
): Promise<CustomerWithDuplicates> {
  const existing = await loadAccessibleCustomer(ctx, id)
  const isIndividual = existing.type === CUSTOMER_TYPES.INDIVIDUAL

  if (isIndividual && input.corporate) {
    throw invalidField('corporate', 'Corporate details do not apply to an individual')
  }
  if (!isIndividual && input.individual) {
    throw invalidField('individual', 'Individual details do not apply to a corporate customer')
  }

  const update: CustomerUpdate = {
    displayName: input.displayName,
    email: input.email,
    phone: input.phone,
    alternatePhone: input.alternatePhone,
    notes: input.notes,
    address: input.address,
    individual: input.individual,
    corporate: input.corporate && {
      ...input.corporate,
      registrationNumber:
        input.corporate.registrationNumber === undefined
          ? undefined
          : (normalizeRegistration(input.corporate.registrationNumber) ?? null),
    },
  }
  if (input.email !== undefined) update.normalizedEmail = normalizeEmail(input.email) ?? null
  if (input.phone !== undefined) update.normalizedPhone = normalizePhone(input.phone) ?? null

  // Keep the display name in step with the name fields unless the client set it explicitly.
  if (input.displayName === undefined && (input.individual || input.corporate)) {
    const next = buildDisplayName({
      type: existing.type,
      individual: existing.individual && {
        firstName: input.individual?.firstName ?? existing.individual.firstName,
        middleName:
          input.individual?.middleName === undefined
            ? existing.individual.middleName
            : input.individual.middleName,
        lastName: input.individual?.lastName ?? existing.individual.lastName,
      },
      corporate: existing.corporate && {
        legalName: input.corporate?.legalName ?? existing.corporate.legalName,
        tradeName:
          input.corporate?.tradeName === undefined
            ? existing.corporate.tradeName
            : input.corporate.tradeName,
      },
    })
    if (next) update.displayName = next
  }

  const updated = await updateCustomer(existing.id, existing.organizationId, update)
  if (!updated) throw notFound('Customer was not found.')

  const before = matchKeysOf(existing)
  const after = matchKeysOf(updated)
  const matchKeysChanged =
    before.normalizedEmail !== after.normalizedEmail ||
    before.normalizedPhone !== after.normalizedPhone ||
    before.registrationNumber !== after.registrationNumber
  const duplicateCandidates = matchKeysChanged ? await detectDuplicates(ctx, updated) : []

  await recordAuditEvent({
    action: AUDIT_ACTIONS.CUSTOMER_UPDATE,
    entityType: AUDIT_ENTITY_TYPES.CUSTOMER,
    entityId: updated.id,
    actorUserId: ctx.userId,
    organizationId: updated.organizationId,
    branchId: updated.branchId,
    // Field names only; values (contact details, identity numbers) are not logged.
    metadata: {
      customerNumber: updated.customerNumber,
      changedFields: Object.entries(input)
        .filter(([, value]) => value !== undefined)
        .map(([key]) => key),
    },
    meta,
  })
  return { ...toCustomerResource(updated, false), duplicateCandidates }
}

/**
 * Deactivating or suspending needs `customer.deactivate`; returning to ACTIVE needs
 * `customer.update`. The write is compare-and-set on the current status.
 */
export async function changeCustomerStatus(
  ctx: AccessContext,
  id: string,
  input: ChangeCustomerStatusBody,
  meta: RequestMeta,
): Promise<CustomerResource> {
  const to = input.status
  assertPermission(
    ctx,
    to === CUSTOMER_STATUSES.ACTIVE ? PERMISSIONS.CUSTOMER_UPDATE : PERMISSIONS.CUSTOMER_DEACTIVATE,
  )

  const customer = await loadAccessibleCustomer(ctx, id)
  const from = customer.status
  if (from === to) throw invalidField('status', `Customer is already ${toPublicEnum(to)}`)

  const updated = await transitionCustomerStatus(customer.id, customer.organizationId, from, to)
  if (!updated) throw conflict('Customer status changed in the meantime. Reload and retry.')

  await recordAuditEvent({
    action: AUDIT_ACTIONS.CUSTOMER_STATUS_CHANGE,
    entityType: AUDIT_ENTITY_TYPES.CUSTOMER,
    entityId: updated.id,
    actorUserId: ctx.userId,
    organizationId: updated.organizationId,
    branchId: updated.branchId,
    metadata: { customerNumber: updated.customerNumber, from, to, reason: input.reason },
    meta,
  })
  return toCustomerResource(updated, false)
}
