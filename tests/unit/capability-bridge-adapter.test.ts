import { describe, expect, it, vi } from 'vitest'
import { createCapabilityApi } from '../../src/renderer/capabilities/capability-api.js'
import { CapabilityError } from '../../src/shared/errors/capability-error.js'

describe('renderer capability bridge adapter', () => {
  it('unwraps immutable success results without changing the logical API', async () => {
    const api = createCapabilityApi({
      runtime: {
        readOnly: false,
        e2e: false,
        memory: vi.fn().mockResolvedValue({ ok: true, payload: 42 })
      }
    })
    await expect(api.runtime.memory()).resolves.toBe(42)
  })

  it('reconstructs capability failures in the renderer realm', async () => {
    const api = createCapabilityApi({
      runtime: {
        readOnly: false,
        e2e: false,
        memory: vi.fn().mockResolvedValue({
          ok: false,
          error: { code: 'read_only', retryable: false }
        })
      }
    })
    const error = await api.runtime.memory().catch((cause: unknown) => cause)
    expect(error).toBeInstanceOf(CapabilityError)
    expect(error).toMatchObject({ code: 'read_only', retryable: false })
  })

  it('maps malformed bridge data to a protocol violation', async () => {
    const api = createCapabilityApi({
      runtime: {
        readOnly: false,
        e2e: false,
        memory: vi.fn().mockResolvedValue(42)
      }
    })
    await expect(api.runtime.memory()).rejects.toMatchObject({
      code: 'protocol_violation'
    })
  })
})
