import { findEmployeeById } from '../../repositories/hr/hr.repository.js'
import { invalidField } from '../../utils/httpErrors.js'

const MAX_DEPTH = 20

/**
 * Prevents self-management and cycles when assigning a manager.
 * Walks up from the proposed manager; if `employeeId` appears, the graph would cycle.
 */
export async function assertValidManagerAssignment(input: {
  organizationId: string
  employeeId: string
  managerEmployeeId: string
}) {
  if (input.employeeId === input.managerEmployeeId) {
    throw invalidField('managerEmployeeId', 'An employee cannot manage themselves.')
  }

  let currentId: string | undefined = input.managerEmployeeId
  let depth = 0
  while (currentId && depth < MAX_DEPTH) {
    if (currentId === input.employeeId) {
      throw invalidField('managerEmployeeId', 'This manager assignment would create a cycle.')
    }
    const manager = await findEmployeeById(currentId)
    if (!manager || manager.organizationId !== input.organizationId) {
      throw invalidField('managerEmployeeId', 'Manager was not found in this organization.')
    }
    currentId = manager.managerEmployeeId
    depth += 1
  }
}
