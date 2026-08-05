import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, normalize, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  coreOperations,
  mainOperations
} from '../../src/shared/contracts/operations.js'

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
    expect(preload).toContain("coreOperations['projection.read']")
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

  it('keeps module recovery and heavyweight rendering at explicit boundaries', () => {
    const shell = source('src/renderer/shell/app.tsx')
    const workspace = source('src/renderer/features/workspace/workspace.tsx')
    const canvasEntry = source('src/renderer/features/hex/hex-map-canvas.tsx')
    const canvasImplementation = source(
      'src/renderer/features/hex/hex-map-canvas-pixi.tsx'
    )
    expect(shell).toContain('<ModuleHost')
    expect(shell).toContain("import('../features/workspace/workspace.js')")
    expect(workspace).toContain('workspaceDefinitions.map')
    expect(workspace).toContain('loadCatalogWorkspace')
    expect(workspace).toContain('loadHexEditor')
    expect(canvasEntry).toContain("import('./hex-map-canvas-pixi.js')")
    expect(canvasEntry).not.toContain("from 'pixi.js'")
    expect(canvasImplementation).toContain("from 'pixi.js'")
  })

  it('injects renderer capabilities without mutable module state', () => {
    expect(source('src/renderer/src.tsx')).not.toContain(
      'installRendererCapabilityApi'
    )
    expect(() =>
      source('src/renderer/capabilities/renderer-capability-api.ts')
    ).toThrow()
    for (const feature of [
      'catalog',
      'creatures',
      'encounter-table',
      'encounter',
      'hex',
      'party',
      'session'
    ]) {
      const adapter = source(
        `src/renderer/features/${feature}/${feature}-capabilities.ts`
      )
      expect(adapter).toContain('api: SaltMarcherApi')
      expect(adapter).toContain('return api')
    }
  })

  it('keeps renderer styling in tokens, shell and owning features', () => {
    expect(
      source('src/renderer/shell/app.css').split('\n').length
    ).toBeLessThan(600)
    for (const feature of ['session', 'party', 'catalog', 'encounter', 'hex'])
      expect(
        source(`src/renderer/features/${feature}/${feature}.css`).trim().length,
        `${feature} owns no feature styles`
      ).toBeGreaterThan(0)
    expect(
      source('src/renderer/features/creatures/creatures.css').trim().length
    ).toBeGreaterThan(0)
    expect(source('src/renderer/shell/app.css')).not.toMatch(
      /\.(?:catalog|session|encounter|hex|party|group|creature)-/
    )
  })

  it('keeps shared creature and dialog primitives independent of consumers', () => {
    for (const file of codeFiles('src/renderer/features/catalog'))
      expect(source(file), `${file} imports Session`).not.toMatch(
        /from ['"]\.\.\/session\//
      )
    for (const file of codeFiles('src/renderer/features/session'))
      expect(source(file), `${file} imports Catalog`).not.toMatch(
        /from ['"]\.\.\/catalog\//
      )
    for (const file of codeFiles('src/renderer/features/creature-collection'))
      expect(source(file), `${file} imports a consumer feature`).not.toMatch(
        /from ['"]\.\.\/(?:catalog|session)\//
      )
    for (const file of codeFiles('src/renderer/features/creatures'))
      expect(source(file), `${file} imports a consumer feature`).not.toMatch(
        /from ['"]\.\.\/(?:catalog|session|creature-collection)\//
      )
    expect(source('src/renderer/shell/modal-dialog.tsx')).toContain(
      "import './modal-dialog.css'"
    )
    expect(source('src/renderer/features/session/session.css')).not.toContain(
      '.modal-backdrop'
    )
  })

  it('keeps CatalogWorkspace as a small composition root without editors', () => {
    const root = source('src/renderer/features/catalog/catalog-workspace.tsx')
    expect(root.split('\n').length).toBeLessThan(200)
    expect(root).not.toMatch(
      /function .*Dialog|<ModalDialog|<EncounterTableManager/
    )
    for (const controller of [
      'src/renderer/features/catalog/monster-catalog-controller.ts',
      'src/renderer/features/catalog/location-catalog-controller.ts',
      'src/renderer/features/catalog/faction-catalog-controller.ts',
      'src/renderer/features/encounter-table/encounter-table-catalog-controller.ts'
    ])
      expect(source(controller)).toContain('active')
  })

  it('gives every renderer feature a screen, hook, adapter and owned CSS', () => {
    const screens = {
      session: 'session-workspace.tsx',
      catalog: 'catalog-workspace.tsx',
      hex: 'hex-editor.tsx',
      party: 'party-controls.tsx',
      encounter: 'encounter-panels.tsx'
    } as const
    for (const [feature, screen] of Object.entries(screens)) {
      const directory = `src/renderer/features/${feature}`
      const files = readdirSync(directory)
      expect(files).toContain(screen)
      expect(files).toContain(`${feature}-capabilities.ts`)
      expect(files).toContain(`${feature}.css`)
      expect(
        files.some(
          (file) => file.startsWith('use-') || file.endsWith('-state.ts')
        ),
        `${feature} has no feature hook or reducer`
      ).toBe(true)
      for (const file of codeFiles(directory))
        if (!file.endsWith(`${feature}-capabilities.ts`))
          expect(
            source(file),
            `${file} bypasses its capability adapter`
          ).not.toContain('window.saltMarcher')
    }
  })

  it('keeps static UI copy behind typed message keys', () => {
    const rendererFiles = [
      ...codeFiles('src/renderer/features'),
      'src/renderer/passive.tsx'
    ].filter((file) => file.endsWith('.tsx'))
    for (const file of rendererFiles) {
      const content = source(file)
      expect(content, `${file} contains static visible JSX copy`).not.toMatch(
        />[^<>{\n]*[A-Za-zÄÖÜäöü][^<>{\n]*<\//
      )
      expect(
        content,
        `${file} contains a static accessibility label`
      ).not.toMatch(
        /(?:aria-label|title|placeholder)="[^"]*[A-Za-zÄÖÜäöü][^"]*"/
      )
    }
  })

  it('uses one complete operation table across process boundaries', () => {
    const operations = [
      ...Object.values(coreOperations),
      ...Object.values(mainOperations)
    ]
    const channels = operations
      .map((operation) => operation.channel)
      .filter((channel) => channel !== null)
    expect(new Set(channels).size).toBe(channels.length)
    expect(
      operations.every((operation) => operation.deadlineMs === 10_000)
    ).toBe(true)
    expect(
      source('src/main/application-lifecycle/capability-registration.ts')
    ).toContain('Object.entries(coreOperations)')
    expect(
      source('src/main/application-lifecycle/capability-registration.ts')
    ).toContain('Object.entries(mainOperations)')
    const utility = source('src/utility/index.ts')
    expect(utility).toContain('satisfies CoreHandlers')
    for (const feature of [
      'campaign',
      'party',
      'creature',
      'worldPlanner',
      'session',
      'encounter',
      'hex',
      'travel',
      'lifecycle'
    ]) {
      expect(utility).toContain(`const ${feature}Handlers =`)
      expect(utility).toContain(`...${feature}Handlers`)
    }
    const preloadInvocations = [
      source('src/preload/capability-bridge/index.ts'),
      source('src/preload/passive.ts')
    ]
      .join('\n')
      .matchAll(/ipcRenderer\.invoke\(['"]([^'"]+)['"]/g)
    for (const match of preloadInvocations)
      expect(
        channels,
        `preload invokes undefined channel ${match[1]}`
      ).toContain(match[1])
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

  it('keeps combat persistence as runtime references to owning aggregates', () => {
    const combat = source('src/core/encounter/live-combat.ts')
    const combatantTable = combat.match(
      /CREATE TABLE IF NOT EXISTS encounter_combatants \([\s\S]*?\n {4}\);/
    )?.[0]
    expect(combatantTable).toBeDefined()
    expect(combatantTable).not.toMatch(
      /current_hp|max_hp|armor_class|conditions|creature_id|name|detail|xp/
    )
    expect(combat).not.toContain('threshold_fraction')
    expect(combat).not.toContain('member_ids TEXT')
  })

  it('keeps scene SQL private and routes renderer capabilities through its provider', () => {
    expect(source('src/core/scene/scene-store.ts')).not.toMatch(
      /\bdatabase\(\)/
    )
    for (const file of codeFiles('src/renderer/features'))
      expect(source(file), `${file} reads the preload global`).not.toContain(
        'window.saltMarcher'
      )
  })

  it('uses the shared accessible dialog primitive for application dialogs', () => {
    for (const file of codeFiles('src/renderer')) {
      if (file.endsWith('modal-dialog.tsx')) continue
      expect(source(file), `${file} defines a raw modal dialog`).not.toMatch(
        /aria-modal|<dialog\b/
      )
    }
  })

  it('composes both creature collection editors through the shared manager', () => {
    expect(source('src/renderer/features/session/group-dialog.tsx')).toContain(
      'CreatureCollectionManagerDialog'
    )
    expect(
      source(
        'src/renderer/features/encounter-table/encounter-table-manager.tsx'
      )
    ).toContain('CreatureCollectionManagerDialog')
  })

  it('routes registered read-only prose surfaces through the reference primitive', () => {
    for (const file of [
      'src/renderer/features/reference/creature-inspector.tsx',
      'src/renderer/features/encounter/combat-card.tsx',
      'src/renderer/features/session/session-group-card.tsx',
      'src/renderer/features/session/session-workspace.tsx'
    ])
      expect(source(file), `${file} bypasses ReadOnlyProse`).toContain(
        'ReadOnlyProse'
      )
    expect(
      source('src/renderer/features/reference/read-only-prose.tsx')
    ).toContain('ReferenceRichText')
  })

  it('uses the shared non-modal surface for reference popovers and windows', () => {
    const referenceUi = source(
      'src/renderer/features/reference/reference-ui.tsx'
    )
    expect(referenceUi).toContain('NonModalSurface')
    expect(referenceUi).not.toMatch(/role=['"]dialog['"]|aria-modal/)
  })

  it('models unbounded maps as mathematical 32 by 32 chunks', () => {
    const contract = source('src/shared/contracts/hex.ts')
    expect(contract).toContain('hexChunkKeySchema')
    expect(contract).toContain('.max(64)')
    expect(contract).toContain('radius')
    expect(source('src/shared/hex/axial-geometry.ts')).toContain(
      'MAX_HEX_BRUSH_RADIUS = 10'
    )
    const geometry = source('src/shared/hex/axial-geometry.ts')
    expect(geometry).toContain('HEX_CHUNK_SIZE = 32')
    expect(geometry).toContain('Math.floor(coordinate.q / HEX_CHUNK_SIZE)')
  })

  it('keeps Hex routes relational and Party travel state explicit', () => {
    const maps = source('src/core/hex/hex-map-store.ts')
    const travel = source('src/core/hex/hex-travel.ts')
    const party = source('src/core/party/party-store.ts')
    expect(maps).toContain('CREATE TABLE IF NOT EXISTS hex_journey_path')
    expect(maps).not.toContain('path_json')
    expect(travel).toContain('JOIN hex_journey_path')
    expect(travel).not.toContain('pathJson')
    expect(party).toContain(
      "travel_state IN ('detached', 'attached-unpositioned', 'hex-positioned')"
    )
    expect(party).not.toMatch(/attached_to_party_token|travel_tile_id/)
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
