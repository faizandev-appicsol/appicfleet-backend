import { Types } from 'mongoose'

export function toObjectId(value: string): Types.ObjectId | null {
  return Types.ObjectId.isValid(value) && /^[a-f\d]{24}$/i.test(value)
    ? new Types.ObjectId(value)
    : null
}

/** Converts identifiers to ObjectIds, dropping invalid values and duplicates. */
export function toObjectIds(values: readonly string[]): Types.ObjectId[] {
  const unique = new Set<string>()
  const result: Types.ObjectId[] = []
  for (const value of values) {
    const id = toObjectId(value)
    if (!id || unique.has(id.toHexString())) continue
    unique.add(id.toHexString())
    result.push(id)
  }
  return result
}

/** Drops undefined values so partial updates never overwrite fields with undefined. */
export function omitUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
