import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  assertExactOperationKeys,
  composeOperationDefinitions,
  none,
  read,
  registerOperations
} from '../../src/shared/contracts/operations/registry.js'

describe('operation registry composition', () => {
  it('rejects duplicate operation ownership before object composition', () => {
    const first = { 'example.read': read('example:read', none, none) }
    const duplicate = { 'example.read': read('other:read', none, none) }
    expect(() => composeOperationDefinitions(first, duplicate)).toThrow(
      'duplicate_operation_kind:example.read'
    )
  })

  it('derives namespace and method from the composed registry key', () => {
    const registry = registerOperations(
      composeOperationDefinitions({
        'example.read': read('example:read', none, none)
      })
    )
    expect(registry['example.read']).toMatchObject({
      namespace: 'example',
      method: 'read'
    })
  })

  it.each([
    ['missing', ['one', 'two'], ['one']],
    ['extra', ['one'], ['one', 'two']]
  ])('rejects %s runtime ownership', (_name, expected, actual) => {
    expect(() => assertExactOperationKeys('owner', expected, actual)).toThrow(
      'owner_operation_mismatch'
    )
  })

  it('keeps the public registry as composition instead of a contract catalog', () => {
    const source = readFileSync('src/shared/contracts/operations.ts', 'utf8')
    expect(source).toContain('composeOperationDefinitions(')
    expect(source).not.toMatch(/^\s*'[A-Za-z]+\.[A-Za-z]+':/m)
  })
})
