import { readFileSync } from 'node:fs'
import { expect } from 'vitest'
import { rendererControllerBoundaryViolations } from '../../scripts/architecture/renderer-controller-boundary.js'
import { architectureGate } from './support/architecture-gate.js'
import {
  callCount,
  codeFiles,
  hasCall,
  hasImport,
  importCycles,
  readTypeScriptModule,
  relativeImportGraph
} from './support/typescript-module.js'

architectureGate(
  'import-dependency-boundary',
  'derives renderer controller ownership from imports and calls',
  () => {
    const sources = sourceMap('src/renderer')
    expect(rendererControllerBoundaryViolations(sources)).toEqual([])
    const mutations = [
      {
        path: 'src/renderer/features/session/session-group-card.tsx',
        append: '\nuseCapabilityApi()\n',
        code: 'view_owns_controller_hook'
      },
      {
        path: 'src/renderer/features/session/use-group-manager-controller.ts',
        append: '\nuseRef(null)\n',
        code: 'group_controller_owns_local_state'
      },
      {
        path: 'src/renderer/features/session-planner/budget-panel.tsx',
        append:
          "\nimport type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'\n",
        code: 'general_api_outside_adapter'
      }
    ] as const
    for (const mutation of mutations)
      expect(
        rendererControllerBoundaryViolations({
          ...sources,
          [mutation.path]: `${sources[mutation.path]}${mutation.append}`
        })
      ).toContainEqual(
        expect.objectContaining({ path: mutation.path, code: mutation.code })
      )
  }
)

architectureGate(
  'behavior-integration',
  'shares one Group coordinator across query and command boundaries',
  () => {
    const controller = readTypeScriptModule(
      'src/renderer/features/session/use-group-manager-controller.ts'
    )
    for (const call of [
      'useAsyncCommandCoordinator',
      'useGroupManagerQueries',
      'useGroupManagerCommands',
      'createGroupManagerInteractions',
      'projectGroupManagerView'
    ])
      expect(hasCall(controller, call), call).toBe(true)
    for (const adapter of [
      'src/renderer/features/session/use-group-manager-queries.ts',
      'src/renderer/features/session/use-group-manager-commands.ts'
    ]) {
      const module = readTypeScriptModule(adapter)
      expect(module.identifiers.has('AsyncCommandCoordinator')).toBe(true)
      expect(module.identifiers.has('useAsyncCommandCoordinator')).toBe(false)
    }
  }
)

architectureGate(
  'behavior-integration',
  'splits NPC and Location catalogs into query, mutation and projection adapters',
  () => {
    for (const [path, calls] of [
      [
        'src/renderer/features/catalog/npc-catalog-controller.ts',
        [
          'useAsyncCommandCoordinator',
          'useNpcCatalogQueries',
          'useNpcCatalogMutations',
          'projectNpcCatalog'
        ]
      ],
      [
        'src/renderer/features/catalog/location-catalog-controller.ts',
        [
          'useAsyncCommandCoordinator',
          'useLocationCatalogQueries',
          'useLocationCatalogMutations',
          'useLocationCatalogProjection'
        ]
      ]
    ] as const) {
      const controller = readTypeScriptModule(path)
      for (const call of calls)
        expect(hasCall(controller, call), call).toBe(true)
      expect(controller.identifiers.has('useRef')).toBe(false)
      expect(controller.identifiers.has('AbortController')).toBe(false)
    }
  }
)

architectureGate(
  'behavior-integration',
  'composes Hex writes from the shared async, transport and projection boundaries',
  () => {
    const controller = readTypeScriptModule(
      'src/renderer/features/hex/use-hex-command-controller.ts'
    )
    for (const call of [
      'useAsyncCommandCoordinator',
      'createHexCommandTransport',
      'createHexMapWriteCommands',
      'createHexLocationWriteCommands',
      'projectHexCommandResult'
    ])
      expect(hasCall(controller, call), call).toBe(true)
    expect(controller.identifiers.has('HexCommandQueue')).toBe(false)
  }
)

architectureGate(
  'behavior-integration',
  'keeps Session Planner composition thin across its domain controllers',
  () => {
    const controller = readTypeScriptModule(
      'src/renderer/features/session-planner/use-session-planner-controller.ts'
    )
    for (const call of [
      'useAsyncCommandCoordinator',
      'useSessionPlannerWorkspace',
      'useEncounterPlanSearch',
      'useSessionPlannerSessionCommands',
      'useSessionPreparation',
      'useSessionRewardMaterialization'
    ])
      expect(hasCall(controller, call), call).toBe(true)
    expect(controller.identifiers.has('searchEpoch')).toBe(false)
  }
)

architectureGate(
  'behavior-integration',
  'splits Travel async work across coordinator-owned boundaries',
  () => {
    const path = 'src/renderer/features/travel/use-travel-controller.ts'
    const controller = readTypeScriptModule(path)
    for (const call of [
      'useAsyncCommandCoordinator',
      'useTravelViewProjection',
      'useTravelQueries',
      'useTravelCommands',
      'useTravelRemoteReconciliation'
    ])
      expect(hasCall(controller, call), call).toBe(true)
    for (const infrastructure of [
      'useEffect',
      'useRef',
      'AbortController',
      'TravelRequestFactory'
    ])
      expect(controller.identifiers.has(infrastructure), infrastructure).toBe(
        false
      )
    const queries = readTypeScriptModule(
      'src/renderer/features/travel/use-travel-queries.ts'
    )
    expect(queries.stringLiterals).toContain('latest-only')
    for (const scope of [
      'travel.context-query',
      'travel.map-query',
      'travel.evaluation-query'
    ])
      expect(queries.stringLiterals, scope).toContain(scope)

    const commands = readTypeScriptModule(
      'src/renderer/features/travel/use-travel-commands.ts'
    )
    expect(commands.stringLiterals).toContain('queue')
    expect(commands.stringLiterals).toContain('travel.command')

    const reconciliation = readTypeScriptModule(
      'src/renderer/features/travel/use-travel-remote-reconciliation.ts'
    )
    expect(hasCall(reconciliation, 'useEffect')).toBe(true)
    expect(hasCall(reconciliation, 'cancelAll')).toBe(true)
    expect(hasCall(reconciliation, 'subscribe')).toBe(true)

    const projection = readTypeScriptModule(
      'src/renderer/features/travel/travel-view-projection.ts'
    )
    expect(hasCall(projection, 'useState')).toBe(true)
    expect(
      projection.imports.some(({ specifier }) =>
        specifier.includes('async-command-coordinator')
      )
    ).toBe(false)

    for (const travelPath of codeFiles('src/renderer/features/travel')) {
      const module = readTypeScriptModule(travelPath)
      expect(module.identifiers.has('TravelRequestFactory'), travelPath).toBe(
        false
      )
      expect(module.constructions, travelPath).not.toContain(
        'AsyncCommandCoordinator'
      )
    }
  }
)

architectureGate(
  'import-dependency-boundary',
  'erases every renderer import from schema-bearing contracts',
  () => {
    for (const path of codeFiles('src/renderer'))
      for (const dependency of readTypeScriptModule(path).imports.filter(
        ({ specifier }) => specifier.includes('shared/contracts')
      ))
        expect(
          dependency.typeOnly,
          `${path} imports ${dependency.specifier}`
        ).toBe(true)
  }
)

architectureGate(
  'import-dependency-boundary',
  'keeps module recovery and heavyweight rendering at explicit boundaries',
  () => {
    const expectations: readonly [string, string, 'dynamic' | 'static'][] = [
      [
        'src/renderer/shell/app.tsx',
        '../features/workspace/workspace.js',
        'dynamic'
      ],
      [
        'src/renderer/features/workspace/workspace-definition.ts',
        './surfaces/session-surface.js',
        'dynamic'
      ],
      [
        'src/renderer/features/workspace/workspace-definition.ts',
        './surfaces/catalog-surface.js',
        'dynamic'
      ],
      [
        'src/renderer/features/workspace/workspace-definition.ts',
        './surfaces/hex-surface.js',
        'dynamic'
      ],
      [
        'src/renderer/features/hex/hex-map-canvas.tsx',
        './hex-map-canvas-pixi.js',
        'dynamic'
      ],
      [
        'src/renderer/features/workspace/campaign-menu.tsx',
        './campaign-management-dialog.js',
        'dynamic'
      ]
    ]
    for (const [path, specifier, kind] of expectations)
      expect(hasImport(readTypeScriptModule(path), specifier, kind), path).toBe(
        true
      )
    for (const path of [
      'src/renderer/features/hex/hex-map-canvas.tsx',
      'src/renderer/features/hex/hex-canvas-gesture-controller.ts',
      'src/renderer/features/hex/hex-canvas-keyboard-controller.ts'
    ])
      expect(hasImport(readTypeScriptModule(path), 'pixi.js'), path).toBe(false)
    const pixi = readTypeScriptModule(
      'src/renderer/features/hex/hex-map-canvas-pixi.tsx'
    )
    expect(hasImport(pixi, '../../spatial-2d/pixi-webgl-runtime.js')).toBe(true)
    expect(pixi.objectLiteralValues).toContainEqual({
      name: 'manageImports',
      value: false
    })
    for (const name of [
      'attachHexCanvasGestures',
      'hexCanvasKeyboardCommand',
      'HexLocationMarkerOverlay'
    ])
      expect(pixi.identifiers.has(name)).toBe(true)
    const editor = readTypeScriptModule(
      'src/renderer/features/hex/hex-editor.tsx'
    )
    expect(editor.jsxTags).toEqual(
      expect.arrayContaining([
        'HexCatalogPane',
        'HexCanvasSurface',
        'HexStatePane'
      ])
    )
    for (const hook of [
      'useHexMapController',
      'useHexCommandController',
      'useWorldLocationProjectionController'
    ])
      expect(hasCall(editor, hook)).toBe(true)
  }
)

architectureGate(
  'behavior-integration',
  'centralizes generator matrix, tuning and fingerprint semantics',
  () => {
    const model = readTypeScriptModule(
      'src/shared/generator/generator-config-model.ts'
    )
    expect(model.exportedDeclarations.has('roleAt')).toBe(true)
    expect(model.exportedDeclarations.has('updateRoleCell')).toBe(true)
    for (const path of [
      'src/renderer/features/workspace/generator-role-matrix.tsx',
      'src/renderer/features/workspace/use-batched-matrix-paint.ts'
    ]) {
      const module = readTypeScriptModule(path)
      expect(hasCall(module, 'roleAt')).toBe(true)
      expect(module.nestedElementAccessRoots).not.toContain('roleMatrix')
    }
    expect(
      hasCall(
        readTypeScriptModule(
          'src/renderer/features/workspace/use-batched-matrix-paint.ts'
        ),
        'updateRoleCell'
      )
    ).toBe(true)
    for (const path of [
      'src/core/scene/group-generator.ts',
      'src/core/session-generation/encounter-engine.ts',
      'src/core/encounter/combat-service.ts'
    ])
      expect(
        hasCall(readTypeScriptModule(path), 'fingerprintGeneratorConfig'),
        path
      ).toBe(true)
  }
)

architectureGate(
  'import-dependency-boundary',
  'keeps the TypeScript import graph acyclic',
  () => {
    expect(
      importCycles(relativeImportGraph(codeFiles('src/renderer')))
    ).toEqual([])
  }
)

architectureGate(
  'typed-contract',
  'keeps the Hex capability projection explicitly narrow',
  () => {
    const adapter = readTypeScriptModule(
      'src/renderer/features/hex/hex-capabilities.ts'
    )
    expect(adapter.objectProperties).toEqual(
      expect.arrayContaining([
        'hex',
        'locations',
        'locationSymbols',
        'pickLocationSymbolFile'
      ])
    )
    expect(adapter.objectProperties).not.toEqual(
      expect.arrayContaining(['encounterTables', 'factions'])
    )
    expect(adapter.propertyAccesses).toContain(
      'api.runtime.pickLocationSymbolFile'
    )
  }
)

architectureGate(
  'typed-contract',
  'keeps campaign reward views behind their narrow port',
  () => {
    const port = readTypeScriptModule(
      'src/renderer/features/workspace/campaign-reward-rules-port.ts'
    )
    expect(port.declarations.has('CampaignRewardRulesPort')).toBe(true)
    expect(port.identifiers.has('SaltMarcherApi')).toBe(true)
    for (const name of [
      'campaign-reward-rules-card.tsx',
      'encounter-generator-settings.tsx',
      'encounter-generator-settings-route.tsx',
      'campaign-menu.tsx',
      'workspace-top-bar.tsx'
    ]) {
      const module = readTypeScriptModule(
        `src/renderer/features/workspace/${name}`
      )
      expect(module.identifiers.has('CampaignRewardRulesPort'), name).toBe(true)
      expect(module.identifiers.has('SaltMarcherApi'), name).toBe(false)
    }
  }
)

architectureGate(
  'import-dependency-boundary',
  'keeps Planner, Loot, and campaign rules behind lazy UI leaves',
  () => {
    expect(
      hasImport(
        readTypeScriptModule(
          'src/renderer/features/workspace/workspace-definition.ts'
        ),
        './surfaces/planner-surface.js',
        'dynamic'
      )
    ).toBe(true)
    for (const path of [
      'src/renderer/features/session-planner/session-planner-dialog-host.tsx',
      'src/renderer/features/session/group-manager-catalog.tsx',
      'src/renderer/features/session/group-manager-draft-pane.tsx',
      'src/renderer/features/party/party-controls.tsx'
    ])
      expect(
        readTypeScriptModule(path).imports.some(
          ({ specifier, kind }) =>
            kind === 'dynamic' && specifier.includes('../loot/')
        ),
        path
      ).toBe(true)
    const host = readTypeScriptModule(
      'src/renderer/features/session/session-dialog-host.tsx'
    )
    expect(hasImport(host, './group-dialog.js', 'dynamic')).toBe(true)
    expect(hasImport(host, './group-dialog.js', 'static')).toBe(false)
  }
)

architectureGate(
  'import-dependency-boundary',
  'composes Session travel only at the workspace integration boundary',
  () => {
    for (const directory of [
      'src/renderer/features/session',
      'src/renderer/features/travel'
    ])
      for (const path of codeFiles(directory)) {
        const module = readTypeScriptModule(path)
        expect(
          module.imports.filter(({ specifier }) => specifier.includes('/hex/')),
          path
        ).toEqual([])
        if (directory.endsWith('/session'))
          expect(hasCall(module, 'useTravelController'), path).toBe(false)
      }
    expect(
      hasCall(
        readTypeScriptModule(
          'src/renderer/features/workspace/integrations/session-travel.tsx'
        ),
        'useTravelController'
      )
    ).toBe(true)
  }
)

architectureGate(
  'import-dependency-boundary',
  'composes World Location editing only at the workspace integration boundary',
  () => {
    for (const path of codeFiles('src/renderer/features')) {
      const module = readTypeScriptModule(path)
      const hex = module.imports.some(({ specifier }) =>
        specifier.includes('/hex/')
      )
      const world = module.imports.some(({ specifier }) =>
        specifier.includes('/worldplanner/')
      )
      if (
        hex &&
        world &&
        !path.includes('/hex/') &&
        !path.includes('/worldplanner/')
      )
        expect(path).toContain('/workspace/integrations/')
    }
    const editing = readTypeScriptModule(
      'src/renderer/features/workspace/integrations/world-location-editing.tsx'
    )
    for (const name of [
      'HexLocationPlacementDialog',
      'IntegratedWorldLocationEditor',
      'createWorldLocationApplicationPort',
      'createHexMapApplicationPort'
    ])
      expect(editing.identifiers.has(name)).toBe(true)
    const catalog = readTypeScriptModule(
      'src/renderer/features/catalog/location-catalog-section.tsx'
    )
    expect(catalog.identifiers.has('HexLocation')).toBe(false)
    expect(catalog.identifiers.has('WorldLocationDialog')).toBe(false)
    expect(
      hasCall(
        readTypeScriptModule(
          'src/renderer/features/workspace/integrations/integrated-world-location-creation.tsx'
        ),
        'useWorldLocationCreationWorkflow'
      )
    ).toBe(true)
  }
)

architectureGate(
  'import-dependency-boundary',
  'keeps the Hex placement projection injected and revision-free',
  () => {
    const field = readTypeScriptModule(
      'src/renderer/features/hex/hex-location-draft-field.tsx'
    )
    expect(field.identifiers.has('useCapabilityApi')).toBe(false)
    expect(hasImport(field, './hex-location-placement.css')).toBe(true)
    expect(field.jsxTags).toEqual(
      expect.arrayContaining([
        'ExpandedHexPlacementDialog',
        'CompactHexPlacementView'
      ])
    )
    const commit = readTypeScriptModule(
      'src/renderer/features/hex/world-location-placement-commit.ts'
    )
    expect(hasCall(commit, 'locations.commitPlacement')).toBe(true)
    for (const forbidden of [
      'expectedContentRevision',
      'formatMessage',
      'readChunks',
      'invalidateChunks',
      'invalidateMap'
    ])
      expect(commit.identifiers.has(forbidden)).toBe(false)
    const owner = readTypeScriptModule(
      'src/renderer/features/hex/use-hex-map-controller.ts'
    )
    expect(callCount(owner, 'capabilities.hex.onChanged')).toBe(1)
    expect(callCount(owner, 'capabilities.biomes.onChanged')).toBe(1)
  }
)

architectureGate(
  'import-dependency-boundary',
  'keeps message types global and runtime dictionaries feature-lazy',
  () => {
    const assembly = readTypeScriptModule(
      'src/renderer/i18n/feature-messages.de.ts'
    )
    expect(assembly.imports).toHaveLength(1)
    expect(assembly.imports[0]).toEqual(
      expect.objectContaining({
        specifier: './message-types.de.js',
        typeOnly: true
      })
    )
    const runtimes = {
      catalog: 'catalogMessagesDe',
      hex: 'hexMessagesDe',
      session: 'sessionMessagesDe',
      reference: 'referenceMessagesDe',
      worldplanner: 'worldplannerMessagesDe'
    } as const
    for (const [feature, own] of Object.entries(runtimes)) {
      const runtime = readTypeScriptModule(
        `src/renderer/i18n/${feature}-runtime.de.ts`
      )
      expect(runtime.identifiers.has(own)).toBe(true)
      for (const foreign of Object.values(runtimes))
        if (foreign !== own)
          expect(runtime.identifiers.has(foreign)).toBe(false)
    }
    for (const path of codeFiles('src/renderer/features'))
      expect(
        readTypeScriptModule(path).imports.some(({ specifier }) =>
          specifier.includes('i18n/messages.de')
        ),
        path
      ).toBe(false)
  }
)

architectureGate(
  'import-dependency-boundary',
  'keeps refactored forms and placement views on injected ports',
  () => {
    for (const path of [
      'src/renderer/features/worldplanner/world-location-form.tsx',
      'src/renderer/features/worldplanner/location-tag-picker.tsx',
      'src/renderer/features/worldplanner/location-reference-picker.tsx',
      'src/renderer/features/hex/compact-hex-placement-view.tsx',
      'src/renderer/features/hex/expanded-hex-placement-dialog.tsx'
    ]) {
      const module = readTypeScriptModule(path)
      expect(module.identifiers.has('useCapabilityApi'), path).toBe(false)
      expect(
        module.propertyAccesses.some((entry) =>
          entry.startsWith('window.saltMarcher')
        ),
        path
      ).toBe(false)
    }
  }
)

architectureGate(
  'import-dependency-boundary',
  'keeps CatalogWorkspace as a composition root without editors',
  () => {
    const root = readTypeScriptModule(
      'src/renderer/features/catalog/catalog-workspace.tsx'
    )
    expect(root.jsxTags).not.toEqual(
      expect.arrayContaining(['ModalDialog', 'EncounterTableManager'])
    )
    for (const path of [
      'src/renderer/features/catalog/monster-catalog-controller.ts',
      'src/renderer/features/catalog/location-catalog-controller.ts',
      'src/renderer/features/catalog/faction-catalog-controller.ts',
      'src/renderer/features/encounter-table/encounter-table-catalog-controller.ts'
    ])
      expect(readTypeScriptModule(path).identifiers.has('active'), path).toBe(
        true
      )
  }
)

function sourceMap(directory: string): Readonly<Record<string, string>> {
  return Object.fromEntries(
    codeFiles(directory).map((path) => [path, readFileSync(path, 'utf8')])
  )
}
