export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

export type PaginationInput = {
  page?: number
  limit?: number
  pageSize?: number
}

export type ResolvedPagination = {
  page: number
  limit: number
  pageSize: number
  skip: number
  take: number
}

export type PageMeta = {
  page: number
  limit: number
  pageSize: number
  total: number
  totalPages: number
}

function normalizePositive(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback
  return Math.max(1, Math.floor(value))
}

export function resolvePagination(input: PaginationInput = {}): ResolvedPagination {
  const page = normalizePositive(input.page, 1)
  const requested = input.limit ?? input.pageSize ?? DEFAULT_PAGE_SIZE
  const limit = Math.min(MAX_PAGE_SIZE, normalizePositive(requested, DEFAULT_PAGE_SIZE))

  return {
    page,
    limit,
    pageSize: limit,
    skip: (page - 1) * limit,
    take: limit,
  }
}

export function buildPageMeta(page: number, limit: number, total: number): PageMeta {
  const safeLimit = Math.max(1, Math.floor(limit))
  const safeTotal = Math.max(0, Math.floor(total))

  return {
    page: Math.max(1, Math.floor(page)),
    limit: safeLimit,
    pageSize: safeLimit,
    total: safeTotal,
    totalPages: safeTotal === 0 ? 0 : Math.ceil(safeTotal / safeLimit),
  }
}

export function toPaginated<T>(items: T[], page: number, limit: number, total: number) {
  return {
    items,
    ...buildPageMeta(page, limit, total),
  }
}
