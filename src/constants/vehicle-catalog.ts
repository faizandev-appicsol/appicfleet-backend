/** Starter makes shown in the vehicle form dropdown until the user saves their own. */
export const DEFAULT_VEHICLE_MAKES = ['Toyota', 'Honda', 'Nissan', 'BMW'] as const

/** Starter types shown in the vehicle form dropdown until the user saves their own. */
export const DEFAULT_VEHICLE_TYPES = ['Sedan', 'SUV', 'Hatchback', 'Van'] as const

/**
 * Merges saved catalog rows with starter defaults.
 * Defaults stay first; user-saved names that match a default reuse the saved id.
 */
export function mergeCatalogWithDefaults(
  items: readonly { id: string; name: string }[],
  defaults: readonly string[],
): { id: string; name: string }[] {
  const byNormalized = new Map(items.map((item) => [item.name.trim().toLowerCase(), item]))
  const result: { id: string; name: string }[] = []
  const used = new Set<string>()

  for (const name of defaults) {
    const key = name.toLowerCase()
    const saved = byNormalized.get(key)
    result.push(saved ?? { id: `default:${key}`, name })
    used.add(key)
  }

  for (const item of items) {
    const key = item.name.trim().toLowerCase()
    if (used.has(key)) continue
    result.push(item)
    used.add(key)
  }

  return result
}
