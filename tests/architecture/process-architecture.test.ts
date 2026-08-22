import { readFileSync } from 'node:fs'
import { expect } from 'vitest'
import { capabilityEvents } from '../../src/shared/contracts/events.js'
import {
  coreOperations,
  mainOperations
} from '../../src/shared/contracts/operations.js'
import { sessionPreparationFailureSchema } from '../../src/shared/contracts/session-planner.js'
import {
  architectureGate,
  legitimateLiteralGate
} from './support/architecture-gate.js'
import {
  codeFiles,
  hasCall,
  hasImport,
  readTypeScriptModule,
  scope
} from './support/typescript-module.js'

architectureGate(
  'typed-contract',
  'derives the public operation and event boundary from exact registries',
  () => {
    const operations = { ...coreOperations, ...mainOperations }
    for (const [kind, definition] of Object.entries(operations)) {
      const [namespace, method] = kind.split('.')
      expect(definition.key).toBe(kind)
      expect(definition.namespace).toBe(namespace)
      expect(definition.method).toBe(method)
      expect(definition.handler).toBe(
        Object.hasOwn(coreOperations, kind) ? 'utility' : 'main'
      )
      expect(definition.diagnostics).toEqual({
        category: namespace,
        redactInput: true
      })
      expect(['read', 'write']).toContain(definition.mode)
      if (definition.mode === 'read' || definition.handler === 'main')
        expect(definition.travelReconciliation).toBeNull()
      expect(definition.deadlineMs).toBeGreaterThan(0)
      expect(definition.roles.length).toBeGreaterThanOrEqual(
        definition.channel === null ? 0 : 1
      )
    }
    for (const kind of [
      'sessionGeneration.generate',
      'sessionGeneration.readRun',
      'generatedEncounterPlans.prepare',
      'generatedEncounterPlans.commit',
      'sessionPlanner.begin',
      'sessionPlanner.resolve',
      'sessionPlanner.commit',
      'session.generateLoot'
    ])
      expect(operations).not.toHaveProperty(kind)

    const api = readTypeScriptModule('src/shared/contracts/capability-api.ts')
    expect(hasImport(api, './operations.js')).toBe(true)
    expect(hasImport(api, './events.js')).toBe(true)
    expect(api.identifiers.has('DerivedOperationApi')).toBe(true)
    expect(api.identifiers.has('DerivedEventApi')).toBe(true)

    const preload = readTypeScriptModule(
      'src/preload/capability-bridge/index.ts'
    )
    expect(preload.identifiers.has('coreOperations')).toBe(true)
    expect(preload.identifiers.has('mainOperations')).toBe(true)
    expect(preload.identifiers.has('capabilityEvents')).toBe(true)
    expect(
      preload.imports.filter(({ specifier }) =>
        /contracts\/(?:loot|session-planner|hex|party|scene|encounter|world-location|biome)\.js/.test(
          specifier
        )
      )
    ).toEqual([])

    const main = readTypeScriptModule(
      'src/main/application-lifecycle/application.ts'
    )
    expect(main.stringLiterals).toContain('core.sessionGenerationCatalog')
    expect(main.stringLiterals).not.toContain('sessionPlanner.read')
    for (const kind of Object.keys(capabilityEvents))
      expect(main.stringLiterals, `${kind} is not routed`).toContain(kind)
  }
)

architectureGate(
  'import-dependency-boundary',
  'keeps session generation pure in core and file access in utility',
  () => {
    for (const path of codeFiles('src/core/session-generation')) {
      const module = readTypeScriptModule(path)
      expect(
        module.imports.filter(
          ({ specifier }) =>
            specifier.startsWith('node:fs') ||
            specifier.includes('src/renderer') ||
            specifier.endsWith('?raw')
        ),
        path
      ).toEqual([])
    }
    expect(
      hasImport(
        readTypeScriptModule(
          'src/utility/session-generation/catalog-provider.ts'
        ),
        'node:fs'
      )
    ).toBe(true)
  }
)

architectureGate(
  'typed-contract',
  'publishes structured Generation and Preparation diagnostics without localized prose',
  () => {
    expect(
      sessionPreparationFailureSchema.safeParse({
        stage: 'generation',
        code: 'catalog-unavailable',
        retryable: true,
        parameters: { catalog: 'session-generation' }
      }).success
    ).toBe(true)
    expect(
      sessionPreparationFailureSchema.safeParse({
        stage: 'generation',
        code: 'catalog-unavailable',
        retryable: true,
        parameters: { nested: { prose: 'invalid' } }
      }).success
    ).toBe(false)
    for (const path of [
      ...codeFiles('src/core/session-generation'),
      ...codeFiles('src/utility/session-generation'),
      ...codeFiles('src/utility/session-planner')
    ])
      expect(
        readTypeScriptModule(path).stringLiterals.filter((value) =>
          /[ÄÖÜäöüß]/.test(value)
        ),
        `${path} contains localized Core output`
      ).toEqual([])
  }
)

architectureGate(
  'import-dependency-boundary',
  'keeps installation settings out of renderer storage and main JSON files',
  () => {
    for (const path of ['src/renderer/src.tsx', 'src/renderer/shell/app.tsx'])
      expect(
        readTypeScriptModule(path).propertyAccesses.filter((entry) =>
          entry.includes('localStorage')
        ),
        path
      ).toEqual([])
    const main = readTypeScriptModule(
      'src/main/application-lifecycle/application.ts'
    )
    expect(main.stringLiterals).not.toContain('session-layout.json')
    expect(hasImport(main, 'node:fs/promises')).toBe(false)
  }
)

architectureGate(
  'typed-contract',
  'gives the passive window only its fail-closed preload',
  () => {
    const windowModule = readTypeScriptModule(
      'src/main/windows/secondary-window.ts'
    )
    expect(windowModule.stringLiterals).toContain('passive.js')
    expect(windowModule.stringLiterals).toContain('passive.html')
    const passive = readTypeScriptModule('src/preload/passive.ts')
    expect(passive.stringLiterals).toContain('projection.read')
    expect(passive.stringLiterals).toContain('runtime.coreStatus')
    expect(
      passive.stringLiterals.filter((value) =>
        /^(?:campaign:|session:read|hex:|settings:)/.test(value)
      )
    ).toEqual([])
  }
)

architectureGate(
  'behavior-integration',
  'keeps travel reads pure and progression in the utility process',
  () => {
    const travel = readTypeScriptModule('src/core/hex/hex-travel.ts')
    expect(scope(travel, 'read')?.calls).not.toContain('this.advance')
    expect(travel.identifiers.has('hintCode')).toBe(true)
    expect(
      travel.stringLiterals.filter((value) =>
        /Reise läuft|Ziel erreicht|Reise pausiert|Reise abgebrochen|Party zuerst/.test(
          value
        )
      )
    ).toEqual([])

    const utility = readTypeScriptModule('src/utility/application.ts')
    const scheduling = readTypeScriptModule('src/utility/domain-scheduling.ts')
    expect(utility.constructions).toContain('TravelBoundaryScheduler')
    expect(hasCall(utility, 'setInterval')).toBe(false)
    expect(hasCall(scheduling, 'this.travel.tick')).toBe(true)
    expect(hasCall(scheduling, 'this.travel.nextBoundaryDelay')).toBe(true)
  }
)

architectureGate(
  'typed-contract',
  'uses one complete operation table across process boundaries',
  () => {
    const operations = [
      ...Object.values(coreOperations),
      ...Object.values(mainOperations)
    ]
    const channels = operations.flatMap(({ channel }) =>
      channel === null ? [] : [channel]
    )
    expect(new Set(channels).size).toBe(channels.length)
    expect(operations.every(({ deadlineMs }) => deadlineMs === 10_000)).toBe(
      true
    )
    const main = readTypeScriptModule(
      'src/main/application-lifecycle/capability-registration.ts'
    )
    expect(main.identifiers.has('coreOperations')).toBe(true)
    expect(main.identifiers.has('mainOperations')).toBe(true)
    const utility = readTypeScriptModule('src/utility/application.ts')
    expect(hasCall(utility, 'composeOperationHandlers')).toBe(true)
    expect(
      utility.stringLiterals.filter((value) => channels.includes(value))
    ).toEqual([])
  }
)

architectureGate(
  'import-dependency-boundary',
  'allows direct IPC invokes only in the central preload adapters',
  () => {
    for (const path of codeFiles('src/preload')) {
      const module = readTypeScriptModule(path)
      const owners = module.scopes
        .filter(({ calls }) => calls.includes('ipcRenderer.invoke'))
        .map(({ name }) => name)
      expect(owners, path).toEqual(
        path === 'src/preload/capability-bridge/index.ts' ||
          path === 'src/preload/passive.ts'
          ? ['invokeIpc']
          : []
      )
    }
  }
)

architectureGate(
  'typed-contract',
  'carries explicit IPC results and creates logical errors in the renderer realm',
  () => {
    const registration = readTypeScriptModule(
      'src/main/application-lifecycle/capability-registration.ts'
    )
    expect(hasCall(registration, 'invokeGeneric')).toBe(true)
    expect(scope(registration, 'invokeGeneric')?.identifiers.has('ok')).toBe(
      true
    )

    const preload = readTypeScriptModule(
      'src/preload/capability-bridge/index.ts'
    )
    expect(hasCall(preload, 'ipcResultSchema.parse')).toBe(true)
    expect(preload.stringLiterals).toContain('saltMarcherBridge')
    expect(preload.stringLiterals).not.toContain('saltMarcher')

    const renderer = readTypeScriptModule(
      'src/renderer/capabilities/capability-api.ts'
    )
    expect(renderer.constructions).toContain('CapabilityError')
    expect(renderer.identifiers.has('unwrapResult')).toBe(true)
    expect(hasImport(renderer, '../../shared/contracts/ipc-result.js')).toBe(
      false
    )

    const errors = readTypeScriptModule('src/shared/errors/capability-error.ts')
    expect(scope(errors, 'capabilityErrorCode')?.propertyAccesses).toEqual([
      'error.code'
    ])
  }
)

legitimateLiteralGate({
  name: 'does not ship qualification code through the normal HTML entry',
  path: 'src/renderer/index.html',
  owner: 'renderer-entrypoints',
  rationale:
    'HTML entrypoint separation is a packaging literal boundary with no TypeScript semantic model.',
  inspect: (normalEntry) => {
    expect(normalEntry.toLowerCase()).not.toContain('qualification')
    expect(normalEntry.toLowerCase()).not.toContain('babylon')
    expect(readFileSync('src/renderer/qualification.html', 'utf8')).toContain(
      '/qualification.tsx'
    )
  }
})
