import { describe, expect, it } from 'vitest'
import { coreOperations } from '../../src/shared/contracts/operations.js'
import { roleCanInvoke } from '../../src/main/application-lifecycle/operation-authorization.js'

describe('operation role authorization', () => {
  it('denies every GM operation to a passive window', () => {
    for (const [kind, definition] of Object.entries(coreOperations)) {
      if (definition.roles.includes('gm'))
        expect(
          roleCanInvoke('passive', kind as keyof typeof coreOperations)
        ).toBe(false)
    }
  })

  it('allows passive windows only the safe projection read', () => {
    const allowed = Object.keys(coreOperations).filter((kind) =>
      roleCanInvoke('passive', kind as keyof typeof coreOperations)
    )
    expect(allowed).toEqual(['projection.read'])
  })
})
