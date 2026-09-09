// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { HexTravelCommandController } from '../../src/renderer/features/hex/hex-travel-command-controller.js'
import { MaintenanceDraftCoordinator } from '../../src/renderer/shell/maintenance-draft-coordinator.js'
import type {
  HexTravelCommand,
  HexTravelCommandState
} from '../../src/shared/contracts/hex-travel-command.js'

function state(
  sceneRevision = 7,
  travelRevision = 3,
  planRevision = 4
): HexTravelCommandState {
  return {
    context: {
      session: { scene: { focusedSceneId: 'scene', revision: sceneRevision } },
      travel: { sceneId: 'scene', revision: travelRevision }
    },
    routePlan: { sceneId: 'scene', revision: planRevision, plan: null }
  } as unknown as HexTravelCommandState
}
const kinds = [
  'save-plan',
  'position',
  'start',
  'pause',
  'resume',
  'abort',
  'set-multiplier'
] as const
function command(kind: (typeof kinds)[number]): HexTravelCommand {
  const base = { sceneId: 'scene', expectedSceneRevision: 7 }
  const commandId = crypto.randomUUID()
  switch (kind) {
    case 'save-plan':
      return {
        commandId,
        command: {
          kind,
          input: { ...base, expectedPlanRevision: 4, plan: null }
        }
      }
    case 'position':
      return {
        commandId,
        command: {
          kind,
          input: { ...base, mapId: 'map', coordinate: { q: 0, r: 0 } }
        }
      }
    case 'start':
      return {
        commandId,
        command: {
          kind,
          input: {
            ...base,
            mapId: 'map',
            waypoints: [{ q: 1, r: 0 }],
            multiplier: 1,
            expectedRevision: 3
          }
        }
      }
    case 'set-multiplier':
      return {
        commandId,
        command: {
          kind,
          input: { ...base, multiplier: 5, expectedRevision: 3 }
        }
      }
    default:
      return {
        commandId,
        command: { kind, input: { ...base, expectedRevision: 3 } }
      }
  }
}
function fixture() {
  const receipt = state(8, 4, 5)
  const current = state(10, 6, 7)
  const port = {
    execute: vi.fn().mockRejectedValue(new Error('lost reply')),
    status: vi.fn().mockResolvedValue({ receipt, ...current }),
    refresh: vi.fn().mockResolvedValue(current)
  }
  const maintenance = new MaintenanceDraftCoordinator()
  const controller = new HexTravelCommandController(port, maintenance)
  const complete = vi.fn()
  controller.attach(complete)
  return { controller, port, maintenance, complete, receipt, current }
}

it.each(kinds)(
  'reconciles original %s using reads and a separate fresh projection',
  async (kind) => {
    const f = fixture()
    const input = command(kind)
    await f.controller.execute(input)
    expect(await f.controller.execute(command(kind))).toBe(false)
    expect(await f.controller.settle()).toBe(true)
    expect(f.port.status).toHaveBeenCalledWith(input)
    expect(f.complete).toHaveBeenCalledWith(f.receipt, f.current)
    expect(f.port.execute).toHaveBeenCalledOnce()
    expect(f.controller.held()).toBe(false)
  }
)

it.each(kinds)(
  'requires scene CAS for an absent %s even if its own revision matches',
  async (kind) => {
    const f = fixture()
    await f.controller.execute(command(kind))
    f.port.status.mockResolvedValue({ receipt: null, ...state(8) })
    f.port.refresh.mockResolvedValue(state(8))
    await f.controller.settle()
    expect(f.controller.snapshot().conflict).toBe(true)
    await expect(f.controller.save()).rejects.toThrow('Reise')
    expect(f.port.execute).toHaveBeenCalledOnce()
    expect(await f.controller.discard()).toBe(true)
  }
)

it.each(['save', 'discard'] as const)(
  'retains a detached absent route save for explicit %s',
  async (choice) => {
    const f = fixture()
    const original = command('save-plan')
    await f.controller.execute(original)
    f.controller.detach()
    f.port.status.mockResolvedValue({ receipt: null, ...state() })
    f.port.refresh.mockResolvedValue(state())
    f.port.execute.mockResolvedValue(f.receipt)
    const resolution = f.maintenance.begin()
    expect(await resolution.resolve(choice)).toEqual([])
    resolution.release()
    expect(f.port.execute).toHaveBeenCalledTimes(choice === 'save' ? 2 : 1)
    expect(f.complete).not.toHaveBeenCalled()
    expect(f.maintenance.hasDirty()).toBe(false)
    if (choice === 'save') {
      const next = f.port.execute.mock.lastCall?.[0] as HexTravelCommand
      expect(next.commandId).not.toBe(original.commandId)
      expect(next.command).toEqual(original.command)
      expect(next.command.kind).toBe('save-plan')
    }
  }
)

it('holds an in-flight detached write until maintenance learns its original outcome', async () => {
  const f = fixture()
  let finish!: (value: HexTravelCommandState) => void
  f.port.execute.mockImplementation(
    () =>
      new Promise<HexTravelCommandState>((resolve) => {
        finish = resolve
      })
  )
  const pending = f.controller.execute(command('start'))
  await Promise.resolve()
  f.controller.detach()
  const resolution = f.maintenance.begin()
  let resolved = false
  const settling = resolution.resolve('discard').then((failures) => {
    resolved = true
    return failures
  })
  await Promise.resolve()
  expect(resolved).toBe(false)
  expect(f.maintenance.hasDirty()).toBe(true)
  finish(f.receipt)
  expect(await pending).toBe(true)
  expect(await settling).toEqual([])
  resolution.release()
  expect(f.complete).not.toHaveBeenCalled()
  expect(f.port.execute).toHaveBeenCalledOnce()
  expect(f.maintenance.hasDirty()).toBe(false)
})

it('keeps failed status and failed post-write refresh blocking without replay', async () => {
  const f = fixture()
  f.port.execute.mockResolvedValue(f.receipt)
  f.port.refresh.mockRejectedValueOnce(new Error('refresh failed'))
  expect(await f.controller.execute(command('abort'))).toBe(false)
  f.controller.detach()
  f.port.status.mockRejectedValueOnce(new Error('read failed'))
  expect(await f.controller.discard()).toBe(false)
  expect(f.maintenance.hasDirty()).toBe(true)
  expect(await f.controller.discard()).toBe(true)
  expect(f.port.execute).toHaveBeenCalledOnce()
  expect(f.maintenance.hasDirty()).toBe(false)
})

it.each([
  ['plan revision', state(7, 3, 5)],
  [
    'focus',
    {
      ...state(),
      context: {
        ...state().context,
        session: {
          ...state().context.session,
          scene: { ...state().context.session.scene, focusedSceneId: 'other' }
        }
      }
    }
  ],
  [
    'travel scene',
    {
      ...state(),
      context: {
        ...state().context,
        travel: { ...state().context.travel, sceneId: 'other' }
      }
    }
  ]
] as const)(
  'rejects an absent plan after changed %s',
  async (_label, changed) => {
    const f = fixture()
    await f.controller.execute(command('save-plan'))
    f.port.status.mockResolvedValue({ receipt: null, ...state() })
    f.port.refresh.mockResolvedValue(changed)
    await f.controller.settle()
    expect(f.controller.snapshot().conflict).toBe(true)
    await expect(f.controller.save()).rejects.toThrow('Reise')
    expect(f.port.execute).toHaveBeenCalledOnce()
  }
)

it('checks fresh revisions again before retry and does not submit after later work', async () => {
  const f = fixture()
  await f.controller.execute(command('pause'))
  f.port.status.mockResolvedValue({ receipt: null, ...state() })
  f.port.refresh.mockResolvedValue(state())
  await f.controller.settle()
  f.port.refresh.mockResolvedValue(state(7, 4))
  await expect(f.controller.save()).rejects.toThrow('Reise')
  expect(f.port.execute).toHaveBeenCalledOnce()
})

it('serializes two explicit saves while retry preflight is in flight', async () => {
  const f = fixture()
  await f.controller.execute(command('resume'))
  f.port.status.mockResolvedValue({ receipt: null, ...state() })
  f.port.refresh.mockResolvedValue(state())
  await f.controller.settle()
  let finish!: (value: HexTravelCommandState) => void
  f.port.refresh.mockImplementationOnce(
    () =>
      new Promise<HexTravelCommandState>((resolve) => {
        finish = resolve
      })
  )
  f.port.execute.mockResolvedValue(f.receipt)
  const first = f.controller.save()
  const second = f.controller.save()
  expect(first).toBe(second)
  expect(f.controller.snapshot().busy).toBe(true)
  await Promise.resolve()
  await Promise.resolve()
  expect(await f.controller.execute(command('abort'))).toBe(false)
  finish(state())
  expect(await first).toBe(true)
  expect(f.port.execute).toHaveBeenCalledTimes(2)
  expect(f.controller.held()).toBe(false)
})
