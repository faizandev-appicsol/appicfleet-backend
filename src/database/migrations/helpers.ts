import type { Collection, CreateIndexesOptions, Document, IndexSpecification } from 'mongodb'

function normalizeKey(key: IndexSpecification): string {
  return Object.entries(key as Record<string, number>)
    .map(([field, direction]) => `${field}_${direction}`)
    .join('_')
}

function isNamespaceMissing(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const err = error as { code?: number; codeName?: string; message?: string }
  return (
    err.code === 26 ||
    err.codeName === 'NamespaceNotFound' ||
    Boolean(err.message?.includes('ns does not exist'))
  )
}

/**
 * Ensures an index exists for the given key.
 * If MongoDB already has that key under another name (e.g. Mongoose `email_1`),
 * the existing index is kept and no rename conflict is raised.
 * Missing collections are created via createIndex (empty Module 18+ domains).
 */
export async function ensureIndex(
  collection: Collection<Document>,
  key: IndexSpecification,
  options: CreateIndexesOptions = {},
): Promise<void> {
  let existing: Awaited<ReturnType<Collection<Document>['indexes']>>
  try {
    existing = await collection.indexes()
  } catch (error) {
    if (!isNamespaceMissing(error)) throw error
    await collection.createIndex(key, options)
    return
  }

  const wanted = normalizeKey(key)
  const match = existing.find((index) => normalizeKey(index.key as IndexSpecification) === wanted)

  if (match) return

  await collection.createIndex(key, options)
}

export async function dropIndexIfExists(
  collection: Collection<Document>,
  names: string | readonly string[],
): Promise<void> {
  const list = typeof names === 'string' ? [names] : names
  let existingNames: string[]
  try {
    existingNames = (await collection.indexes())
      .map((index) => index.name)
      .filter((name): name is string => Boolean(name))
  } catch (error) {
    if (isNamespaceMissing(error)) return
    throw error
  }

  const existing = new Set(existingNames)

  for (const name of list) {
    if (!existing.has(name)) continue
    await collection.dropIndex(name)
  }
}
