import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { runtimeRegistryBoundaryViolations } from '../../scripts/architecture/runtime-registry-boundary.js'

const paths = [
  'src/shared/contracts/operations.ts',
  'src/utility/application.ts',
  'src/preload/capability-bridge/index.ts',
  'src/preload/passive.ts',
  ...readdirSync('src/shared/contracts/operations')
    .filter((file) => file.endsWith('.ts') && file !== 'registry.ts')
    .map((file) => `src/shared/contracts/operations/${file}`),
  ...readdirSync('src/utility/composition')
    .filter((file) => file.endsWith('.ts'))
    .map((file) => `src/utility/composition/${file}`)
]

describe('runtime registry architecture boundary', () => {
  it('accepts the composed registry, preload, and Utility roots', () => {
    expect(runtimeRegistryBoundaryViolations(actualSources())).toEqual([])
  })

  it.each([
    [
      'central operation',
      'src/shared/contracts/operations.ts',
      "\nconst mutation = { 'forbidden.read': {} }\n",
      'central_operation_definition'
    ],
    [
      'inline Utility function',
      'src/utility/application.ts',
      '\nfunction forbiddenInlineOwner(): void {}\n',
      'inline_utility_function'
    ]
  ])('detects the %s mutation', (_name, path, mutation, code) => {
    const sources = actualSources()
    sources[path] = `${sources[path] ?? ''}${mutation}`
    expect(runtimeRegistryBoundaryViolations(sources)).toContainEqual(
      expect.objectContaining({ path, code })
    )
  })

  it('detects removal of the preload completeness assertion', () => {
    const sources = actualSources()
    const path = 'src/preload/capability-bridge/index.ts'
    sources[path] = (sources[path] ?? '').replace(
      /assertExactOperationKeys\([\s\S]*?exposedOperationKinds\n\)/,
      ''
    )
    expect(runtimeRegistryBoundaryViolations(sources)).toContainEqual(
      expect.objectContaining({ path, code: 'missing_completeness_assertion' })
    )
  })

  it('detects removal of typed Utility handler composition', () => {
    const sources = actualSources()
    const path = 'src/utility/application.ts'
    sources[path] = (sources[path] ?? '').replace(
      'composeOperationHandlers(',
      'Object.assign('
    )
    expect(runtimeRegistryBoundaryViolations(sources)).toContainEqual(
      expect.objectContaining({ path, code: 'missing_handler_composition' })
    )
  })

  it('detects a parallel handler key inventory', () => {
    const sources = actualSources()
    const path = 'src/utility/composition/biome.ts'
    sources[path] =
      `${sources[path] ?? ''}\ntype BiomeHandlerName = 'biomes.search'\n`
    expect(runtimeRegistryBoundaryViolations(sources)).toContainEqual(
      expect.objectContaining({ path, code: 'parallel_handler_key_inventory' })
    )
  })

  it('detects an aggregate fragment without an execution owner', () => {
    const sources = actualSources()
    const path = 'src/shared/contracts/operations/biomes.ts'
    sources[path] = (sources[path] ?? '').replaceAll(
      'utilityOperationFragment',
      'unownedFragment'
    )
    expect(runtimeRegistryBoundaryViolations(sources)).toContainEqual(
      expect.objectContaining({
        path,
        code: 'missing_operation_fragment_owner'
      })
    )
  })

  it('detects a passive preload detached from role-derived operations', () => {
    const sources = actualSources()
    const path = 'src/preload/passive.ts'
    sources[path] = (sources[path] ?? '').replaceAll(
      'operationDefinitionsForRole',
      'manualOperationSelection'
    )
    expect(runtimeRegistryBoundaryViolations(sources)).toContainEqual(
      expect.objectContaining({ path, code: 'missing_role_derived_preload' })
    )
  })
})

function actualSources(): Record<string, string> {
  return Object.fromEntries(
    paths.map((path) => [path, readFileSync(path, 'utf8')])
  )
}
