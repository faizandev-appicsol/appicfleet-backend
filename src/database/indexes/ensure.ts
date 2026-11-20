import { AuditEvent } from '../../models/audit-event.model.js'
import { Branch } from '../../models/branch.model.js'
import { LegalEntity } from '../../models/legal-entity.model.js'
import { Organization } from '../../models/organization.model.js'
import { RefreshToken } from '../../models/refresh-token.model.js'
import { Role } from '../../models/role.model.js'
import { User } from '../../models/user.model.js'

/**
 * Safety net that syncs indexes declared on Mongoose schemas.
 * Prefer adding durable index changes through `database/migrations`.
 * Schema indexes and migration indexes must declare the same keys so syncIndexes keeps them.
 */
export async function ensureIndexes(): Promise<void> {
  await Promise.all([
    User.syncIndexes(),
    RefreshToken.syncIndexes(),
    Organization.syncIndexes(),
    LegalEntity.syncIndexes(),
    Branch.syncIndexes(),
    Role.syncIndexes(),
    AuditEvent.syncIndexes(),
  ])
}
