import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, normalize, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { coreOperations } from '../../src/shared/contracts/operations.js'

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

function codeFiles(directory: string): string[] {
  return readdirSync(directory)
    .flatMap((name) => {
      const path = join(directory, name)
      return statSync(path).isDirectory() ? codeFiles(path) : [path]
    })
    .filter((path) => /\.[cm]?[jt]sx?$/.test(path))
}

function relativeImports(path: string): string[] {
  const content = readFileSync(path, 'utf8')
  return [...content.matchAll(/(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g)]
    .map((match) => match[1])
    .filter((value): value is string => value !== undefined)
    .map((value) => normalize(resolve(dirname(path), value)))
}

function expectRelativeImportsWithin(
  layer: string,
  allowedRoots: readonly string[]
): void {
  const roots = allowedRoots.map((root) => normalize(resolve(root)))
  for (const file of codeFiles(layer))
    for (const imported of relativeImports(file))
      expect(
        roots.some(
          (root) => imported === root || imported.startsWith(`${root}/`)
        ),
        `${file} imports forbidden layer ${imported}`
      ).toBe(true)
}

function referencedSqlTables(path: string): string[] {
  return [
    ...readFileSync(path, 'utf8').matchAll(
      /\b(?:FROM|JOIN|INTO|UPDATE|REFERENCES|DELETE\s+FROM|TABLE(?:\s+IF\s+NOT\s+EXISTS)?)\s+([a-z][a-z0-9_]*)/gi
    )
  ]
    .map((match) => match[1]?.toLowerCase())
    .filter((table): table is string => table !== undefined)
}

describe('architecture boundaries', () => {
  it('enforces process-layer import direction', () => {
    expectRelativeImportsWithin('src/renderer', ['src/renderer', 'src/shared'])
    expectRelativeImportsWithin('src/preload', ['src/preload', 'src/shared'])
    expectRelativeImportsWithin('src/main', ['src/main', 'src/shared'])
    expectRelativeImportsWithin('src/core', ['src/core', 'src/shared'])
    expectRelativeImportsWithin('src/utility', [
      'src/utility',
      'src/core',
      'src/shared'
    ])
    for (const file of codeFiles('src/core'))
      expect(source(file), `${file} imports Electron`).not.toMatch(
        /(?:from\s+|import\s*)['"]electron['"]/
      )
  })

  it('keeps SQL table ownership inside the owning aggregate', () => {
    const owners: readonly [RegExp, string][] = [
      [/^hex_/, `${normalize(resolve('src/core/hex'))}/`],
      [
        /^(party_|player_characters$)/,
        `${normalize(resolve('src/core/party'))}/`
      ],
      [/^scene_/, `${normalize(resolve('src/core/scene'))}/`],
      [/^encounter_/, `${normalize(resolve('src/core/encounter'))}/`],
      [/^worldplanner_/, `${normalize(resolve('src/core/worldplanner'))}/`]
    ]
    for (const file of codeFiles('src/core'))
      for (const table of referencedSqlTables(file)) {
        const owner = owners.find(([pattern]) => pattern.test(table))?.[1]
        if (owner)
          expect(
            normalize(resolve(file)).startsWith(owner),
            `${file} references aggregate-owned table ${table}`
          ).toBe(true)
      }
  })

  it('keeps installation settings out of renderer storage and main JSON files', () => {
    expect(source('src/renderer/src.tsx')).not.toContain('localStorage')
    expect(source('src/renderer/shell/app.tsx')).not.toContain('localStorage')
    expect(source('src/main/application-lifecycle/application.ts')).not.toMatch(
      /session-layout\.json|node:fs\/promises/
    )
  })

  it('gives the passive window only its fail-closed preload', () => {
    const windowSource = source('src/main/windows/secondary-window.ts')
    const preload = source('src/preload/passive.ts')
    expect(windowSource).toContain("'passive.js'")
    expect(windowSource).toContain("'passive.html'")
    expect(preload).not.toMatch(/campaign:|session:read|hex:|settings:/)
    expect(preload).toContain("'projection:read'")
    expect(preload).toContain("'runtime:core-status'")
  })

  it('keeps travel reads pure and progression in the utility process', () => {
    const travel = source('src/core/hex/hex-travel.ts')
    const renderer = source('src/renderer/features/hex/hex-workspaces.tsx')
    const utility = source('src/utility/index.ts')
    expect(travel).not.toMatch(
      /read\(requestedSceneId\?[\s\S]*?this\.advance\(journey\)/
    )
    expect(renderer).not.toMatch(/setInterval\([\s\S]{0,120}hexTravel/)
    expect(utility).toContain('hexTravel.tick()')
    expect(utility).not.toContain('setInterval(')
    expect(utility).toContain('nextBoundaryDelay()')
  })

  it('keeps extracted feature workspaces outside the shell composition root', () => {
    const shellLines = source('src/renderer/shell/app.tsx').split('\n').length
    const hexLines = source(
      'src/renderer/features/hex/hex-workspaces.tsx'
    ).split('\n').length
    expect(shellLines).toBeLessThan(100)
    expect(hexLines).toBeLessThan(1_000)
  })

  it('uses one complete operation table across process boundaries', () => {
    const channels = Object.values(coreOperations)
      .map((operation) => operation.channel)
      .filter((channel) => channel !== null)
    expect(new Set(channels).size).toBe(channels.length)
    expect(
      Object.values(coreOperations).every(
        (operation) => operation.deadlineMs === 10_000
      )
    ).toBe(true)
    expect(source('src/main/application-lifecycle/application.ts')).toContain(
      'Object.entries(coreOperations)'
    )
    expect(source('src/utility/index.ts')).toContain('satisfies CoreHandlers')
  })

  it('opens schemas once and never migrates normal commands', () => {
    const all = [
      'src/core/scene/scene-store.ts',
      'src/core/encounter/live-combat.ts',
      'src/core/worldplanner/location-store.ts',
      'src/core/encounter/encounter-table-store.ts',
      'src/core/worldplanner/faction-store.ts',
      'src/core/hex/hex-map-store.ts',
      'src/core/hex/hex-travel.ts'
    ]
      .map(source)
      .join('\n')
    expect(all).not.toMatch(/ALTER TABLE|PRAGMA table_info/)
    expect(all).not.toMatch(/new Database\(/)
  })

  it('models unbounded maps as mathematical 32 by 32 chunks', () => {
    const contract = source('src/shared/contracts/hex.ts')
    const store = source('src/core/hex/hex-map-store.ts')
    expect(contract).toContain('hexChunkKeySchema')
    expect(contract).toContain('.max(64)')
    expect(contract).not.toContain('radius')
    expect(store).toContain('HEX_CHUNK_SIZE = 32')
    expect(store).toContain('Math.floor(coordinate.q / HEX_CHUNK_SIZE)')
  })

  it('does not ship qualification code through the normal HTML entry', () => {
    expect(source('src/renderer/index.html')).not.toMatch(
      /qualification|babylon/i
    )
    expect(source('src/renderer/qualification.html')).toContain(
      '/qualification.tsx'
    )
  })
})
