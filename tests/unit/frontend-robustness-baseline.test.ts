import { describe, expect, it } from 'vitest'
import { readTypeScriptModule } from '../architecture/support/typescript-module.js'

describe('FR0 frontend robustness baseline', () => {
  it('records the current global outcome-unknown readback and remount chain', () => {
    const errors = readTypeScriptModule(
      'src/renderer/capabilities/capability-errors.ts'
    )
    const coordinator = readTypeScriptModule(
      'src/renderer/features/workspace/use-campaign-session-coordinator.ts'
    )
    const routeHost = readTypeScriptModule(
      'src/renderer/features/workspace/workspace-route-host.tsx'
    )

    expect(errors.stringLiterals).toContain('saltmarcher:readback')
    expect(errors.calls).toContain('window.dispatchEvent')
    expect(coordinator.calls).toContain('window.addEventListener')
    expect(coordinator.identifiers.has('readbackKey')).toBe(true)
    expect(coordinator.identifiers.has('setReadbackKey')).toBe(true)
    expect(routeHost.jsxAttributeNames).toContain('key')
    expect(routeHost.identifiers.has('readbackKey')).toBe(true)
  })

  it('records that the Campaign root has no instance-bound async ordering', () => {
    const coordinator = readTypeScriptModule(
      'src/renderer/features/workspace/use-campaign-session-coordinator.ts'
    )

    expect(coordinator.identifiers.has('useAsyncCommandCoordinator')).toBe(
      false
    )
    expect(coordinator.calls).toEqual(
      expect.arrayContaining([
        'api.campaigns.list',
        'api.session.read',
        'campaignsWrite.create',
        'campaignsWrite.activate'
      ])
    )
  })

  it('records current latest-only mutation owners without accepting them as target behavior', () => {
    const baseline = [
      {
        path: 'src/renderer/features/session/use-session-mutation-controller.ts',
        modes: 2,
        scopes: ['session.group-mutation', 'session.snapshot-mutation']
      },
      {
        path: 'src/renderer/features/session/use-group-manager-commands.ts',
        modes: 2,
        scopes: ['group-manager.command']
      },
      {
        path: 'src/renderer/features/session/use-group-manager-loot-commands.ts',
        modes: 2,
        scopes: ['group-manager.loot']
      },
      {
        path: 'src/renderer/features/catalog/use-npc-catalog-mutations.ts',
        modes: 2,
        scopes: ['npc-catalog.mutation']
      },
      {
        path: 'src/renderer/features/catalog/use-location-catalog-mutations.ts',
        modes: 3,
        scopes: ['location-catalog.mutation']
      }
    ] as const

    for (const owner of baseline) {
      const module = readTypeScriptModule(owner.path)
      expect(
        module.objectLiteralValues.filter(
          ({ name, value }) => name === 'mode' && value === 'latest-only'
        ),
        owner.path
      ).toHaveLength(owner.modes)
      for (const scope of owner.scopes)
        expect(module.stringLiterals, `${owner.path}:${scope}`).toContain(scope)
    }
  })

  it('records the existing positive FIFO reference owners', () => {
    const references = [
      'src/renderer/features/hex/hex-command-outcome.ts',
      'src/renderer/features/travel/use-travel-commands.ts',
      'src/renderer/features/session-planner/use-session-planner-session-commands.ts',
      'src/renderer/shell/use-installation-preferences.ts'
    ]

    for (const path of references) {
      const module = readTypeScriptModule(path)
      expect(module.objectProperties, path).toContain('mode')
      expect(module.stringLiterals, path).toContain('queue')
    }
  })
})
