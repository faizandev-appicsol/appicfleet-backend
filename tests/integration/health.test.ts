import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { afterAll, describe, it } from 'vitest'
import { app } from '../../src/app.js'

const server = app.listen(0)

describe('HTTP API', () => {
  afterAll(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      }),
  )

  it('reports process health even when MongoDB is down', async () => {
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Test server has no port')
    const { port } = address as AddressInfo

    const response = await fetch(`http://127.0.0.1:${port}/api/v1/health`)
    const body = (await response.json()) as {
      success: boolean
      data: { status: string; database: string }
    }

    assert.equal(response.status, 200)
    assert.equal(body.success, true)
    assert.equal(body.data.status, 'ok')
    assert.ok(body.data.database === 'up' || body.data.database === 'down')
  })

  it('rejects an empty login body', async () => {
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Test server has no port')
    const { port } = address as AddressInfo

    const response = await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    const body = (await response.json()) as { success: boolean; error: { code: string } }

    assert.equal(response.status, 422)
    assert.equal(body.success, false)
    assert.equal(body.error.code, 'VALIDATION_ERROR')
  })
})
