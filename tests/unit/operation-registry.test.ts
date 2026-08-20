import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  assertExactOperationKeys,
  composeOperationHandlers,
  composeOperationDefinitions,
  defineOperationFragment,
  none,
  operationDefinitionsForRole,
  read,
  registerOperations,
  utilityOperationFragment,
  validatedOperationResult
} from '../../src/shared/contracts/operations/registry.js'
import {
  coreOperations,
  mainOperations
} from '../../src/shared/contracts/operations.js'

describe('operation registry composition', () => {
  it('rejects duplicate operation ownership before object composition', () => {
    const first = utilityOperationFragment({
      'example.read': read('example:read', none, none)
    })
    const duplicate = utilityOperationFragment({
      'example.read': read('other:read', none, none)
    })
    expect(() => composeOperationDefinitions(first, duplicate)).toThrow(
      'duplicate_operation_kind:example.read'
    )
  })

  it('derives namespace and method from the composed registry key', () => {
    const registry = registerOperations(
      composeOperationDefinitions(
        utilityOperationFragment({
          'example.read': read('example:read', none, none)
        })
      ),
      'utility'
    )
    expect(registry['example.read']).toMatchObject({
      key: 'example.read',
      handler: 'utility',
      diagnostics: { category: 'example', redactInput: true },
      namespace: 'example',
      method: 'read'
    })
  })

  it('rejects a fragment registered for the wrong handler owner', () => {
    const fragment = defineOperationFragment('main', {
      'example.read': read('example:read', none, none)
    })
    expect(() => registerOperations(fragment, 'utility')).toThrow(
      'operation_handler_mismatch:example.read:main:utility'
    )
  })

  it.each([
    ['missing', []],
    ['extra', [{ 'other.read': () => undefined }]]
  ])('rejects %s composed handler ownership', (_name, additions) => {
    const definitions = utilityOperationFragment({
      'example.read': read('example:read', none, none)
    })
    expect(() =>
      composeOperationHandlers('handlers', definitions, ...additions)
    ).toThrow('handlers_operation_mismatch')
  })

  it('rejects duplicate handler ownership', () => {
    const definitions = utilityOperationFragment({
      'example.read': read('example:read', none, none)
    })
    const handlers = { 'example.read': () => undefined }
    expect(() =>
      composeOperationHandlers('handlers', definitions, handlers, handlers)
    ).toThrow('duplicate_operation_handler:example.read')
  })

  it('runs post-operation effects only after result validation', () => {
    const definition = utilityOperationFragment({
      'example.read': read('example:read', none, z.string())
    })['example.read']
    const effects: string[] = []

    expect(
      validatedOperationResult(definition, 'valid', (result) =>
        effects.push(result)
      )
    ).toBe('valid')
    expect(() =>
      validatedOperationResult(definition, 42, (result) => effects.push(result))
    ).toThrow()
    expect(effects).toEqual(['valid'])
  })

  it('derives passive preload ownership from operation roles', () => {
    expect(
      Object.keys(operationDefinitionsForRole(coreOperations, 'passive'))
    ).toEqual(['projection.read'])
    expect(
      Object.keys(operationDefinitionsForRole(mainOperations, 'passive'))
    ).toEqual(['runtime.coreStatus'])
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
