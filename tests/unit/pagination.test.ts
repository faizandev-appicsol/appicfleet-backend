import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { buildPageMeta, resolvePagination } from '../../src/utils/pagination.js'

describe('pagination', () => {
  it('uses page and limit to calculate the offset', () => {
    assert.deepEqual(resolvePagination({ page: 2, limit: 20 }), {
      page: 2,
      limit: 20,
      pageSize: 20,
      skip: 20,
      take: 20,
    })
  })

  it('accepts pageSize as an alias and caps the page size', () => {
    const page = resolvePagination({ page: 3, pageSize: 500 })
    assert.equal(page.limit, 100)
    assert.equal(page.pageSize, 100)
    assert.equal(page.skip, 200)
  })

  it('builds metadata for an empty and a partial page', () => {
    assert.equal(buildPageMeta(1, 20, 0).totalPages, 0)
    assert.deepEqual(buildPageMeta(1, 20, 100), {
      page: 1,
      limit: 20,
      pageSize: 20,
      total: 100,
      totalPages: 5,
    })
  })
})
