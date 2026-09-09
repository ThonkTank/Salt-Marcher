// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { HexRoutePlanDraft } from '../../src/renderer/features/hex/hex-route-plan-draft.js'
import { HexTravelCommandController } from '../../src/renderer/features/hex/hex-travel-command-controller.js'
import { MaintenanceDraftCoordinator } from '../../src/renderer/shell/maintenance-draft-coordinator.js'
import type { HexTravelCommandPort } from '../../src/renderer/features/hex/use-hex-travel-command-port.js'
import type {
  HexRoutePlan,
  HexTravelCommandState,
  HexTravelCommand
} from '../../src/shared/contracts/hex-travel-command.js'

const sceneId = 'scene'
const plan: HexRoutePlan = {
  mapId: 'map',
  waypoints: [{ q: 2, r: 3 }],
  multiplier: 2
}
const laterPlan: HexRoutePlan = { ...plan, waypoints: [{ q: 5, r: 1 }] }
function fixture(initial: HexRoutePlan | null = null) {
  const maintenance = new MaintenanceDraftCoordinator()
  let current = {
    context: {
      session: { scene: { focusedSceneId: sceneId, revision: 7 } },
      travel: { sceneId, revision: 3, status: 'paused' }
    },
    routePlan: { sceneId, revision: 2, plan: initial }
  } as unknown as HexTravelCommandState
  const receipts = new Map<string, HexTravelCommandState>()
  const apply = (input: HexTravelCommand) => {
    if (input.command.kind !== 'save-plan')
      throw new Error('Unexpected journey action')
    current = {
      ...current,
      routePlan: {
        sceneId,
        revision: current.routePlan.revision + 1,
        plan: input.command.input.plan
      }
    }
    receipts.set(input.commandId, structuredClone(current))
    return Promise.resolve(structuredClone(current))
  }
  const port = {
    refresh: vi.fn<HexTravelCommandPort['refresh']>(() =>
      Promise.resolve(structuredClone(current))
    ),
    execute: vi.fn<HexTravelCommandPort['execute']>(apply),
    status: vi.fn<HexTravelCommandPort['status']>((input) =>
      Promise.resolve({
        ...structuredClone(current),
        receipt: receipts.get(input.commandId) ?? null
      })
    )
  }
  const commands = new HexTravelCommandController(port, maintenance)
  const draft = new HexRoutePlanDraft(sceneId, port, commands, maintenance)
  commands.attach((_receipt, fresh) => draft.observe(fresh.routePlan))
  draft.observe(current.routePlan)
  return {
    maintenance,
    commands,
    draft,
    port,
    apply,
    current: () => current,
    change: (value: HexTravelCommandState) => {
      current = value
    }
  }
}

describe('Persistent route draft owner', () => {
  it('saves only the route with a fresh scene revision, without starting or altering a journey', async () => {
    const f = fixture()
    f.draft.edit(plan)
    f.change({
      ...f.current(),
      context: {
        ...f.current().context,
        session: {
          ...f.current().context.session,
          scene: { ...f.current().context.session.scene, revision: 8 }
        }
      }
    })
    expect(await f.draft.save()).toBe(true)
    expect(f.port.execute).toHaveBeenCalledOnce()
    expect(f.port.execute.mock.calls[0]![0].command).toEqual({
      kind: 'save-plan',
      input: {
        sceneId,
        expectedPlanRevision: 2,
        expectedSceneRevision: 8,
        plan
      }
    })
    expect(f.current().context.travel).toMatchObject({
      status: 'paused',
      revision: 3
    })
    expect(f.draft.isDirty()).toBe(false)
    expect(await f.draft.save()).toBe(true)
    expect(f.port.execute).toHaveBeenCalledOnce()
  })

  it('treats returning to the loaded plan as clean and clearing as a saved tombstone', async () => {
    const f = fixture(plan)
    f.draft.edit(laterPlan)
    f.draft.edit(plan)
    expect(f.draft.isDirty()).toBe(false)
    f.draft.edit(null)
    expect(f.draft.isDirty()).toBe(true)
    expect(await f.draft.save()).toBe(true)
    expect(f.current().routePlan).toEqual({ sceneId, revision: 3, plan: null })
  })

  it('keeps a dirty plan on remote change and refuses to overwrite the newer basis', async () => {
    const f = fixture()
    f.draft.edit(plan)
    const newer = { sceneId, revision: 3, plan: laterPlan }
    f.change({ ...f.current(), routePlan: newer })
    f.draft.observe(newer)
    expect(f.draft.snapshot().plan).toEqual(plan)
    await expect(f.draft.save()).rejects.toThrow('inzwischen geändert')
    expect(f.draft.isDirty()).toBe(true)
    expect(f.port.execute).not.toHaveBeenCalled()
    expect(await f.draft.discard()).toBe(true)
    expect(f.draft.snapshot().plan).toEqual(laterPlan)
    expect(f.port.execute).not.toHaveBeenCalled()
  })

  it('acknowledges a lost save reply without rewriting later work', async () => {
    const f = fixture()
    f.draft.edit(plan)
    f.port.execute.mockImplementationOnce(async (input) => {
      await f.apply(input)
      throw new Error('reply lost')
    })
    expect(await f.draft.save()).toBe(false)
    expect(f.draft.isDirty()).toBe(true)
    f.change({
      ...f.current(),
      routePlan: { sceneId, revision: 4, plan: laterPlan }
    })
    expect(await f.draft.save()).toBe(true)
    expect(f.port.status).toHaveBeenCalledOnce()
    expect(f.port.execute).toHaveBeenCalledOnce()
    expect(f.draft.snapshot().plan).toEqual(laterPlan)
    expect(f.draft.isDirty()).toBe(false)
  })

  it('retries an absent save only on another explicit save with a new id', async () => {
    const f = fixture()
    f.draft.edit(plan)
    f.port.execute.mockRejectedValueOnce(new Error('not submitted'))
    expect(await f.draft.save()).toBe(false)
    expect(await f.commands.settle()).toBe(true)
    expect(f.port.execute).toHaveBeenCalledOnce()
    expect(await f.draft.save()).toBe(true)
    const [first, second] = f.port.execute.mock.calls.map(([input]) => input)
    expect(second!.command).toEqual(first!.command)
    expect(second!.commandId).not.toBe(first!.commandId)
    expect(f.draft.isDirty()).toBe(false)
  })

  it('retains a failed readback and prevents both discard and new edits until the outcome is known', async () => {
    const f = fixture()
    f.draft.edit(plan)
    f.port.execute.mockImplementationOnce(async (input) => {
      await f.apply(input)
      throw new Error('reply lost')
    })
    expect(await f.draft.save()).toBe(false)
    f.port.status.mockRejectedValueOnce(new Error('offline'))
    expect(await f.draft.discard()).toBe(false)
    expect(f.draft.edit(laterPlan)).toBe(false)
    expect(f.draft.isDirty()).toBe(true)
    expect(await f.draft.discard()).toBe(true)
    expect(f.draft.snapshot().plan).toEqual(plan)
    expect(f.port.execute).toHaveBeenCalledOnce()
  })

  it('keeps the draft on a changed original scene or a failed initial read', async () => {
    const f = fixture()
    f.draft.edit(plan)
    f.port.refresh.mockRejectedValueOnce(new Error('cannot read'))
    await expect(f.draft.save()).rejects.toThrow('cannot read')
    f.change({
      ...f.current(),
      routePlan: { sceneId: 'other', revision: 2, plan: null }
    })
    await expect(f.draft.save()).rejects.toMatchObject({ code: 'stale' })
    expect(f.draft.snapshot().plan).toEqual(plan)
    expect(f.port.execute).not.toHaveBeenCalled()
  })

  it.each([false, true])(
    'retains a detached draft for central save (uncertain: %s)',
    async (uncertain) => {
      const f = fixture()
      f.draft.edit(plan)
      if (uncertain) {
        f.port.execute.mockImplementationOnce(async (input) => {
          await f.apply(input)
          throw new Error('reply lost')
        })
        expect(await f.draft.save()).toBe(false)
      }
      f.commands.detach()
      f.draft.detach()
      expect(f.maintenance.hasDirty()).toBe(true)
      const resolution = f.maintenance.begin()
      try {
        expect(await resolution.resolve('save')).toEqual([])
      } finally {
        resolution.release()
      }
      expect(f.port.execute).toHaveBeenCalledOnce()
      expect(f.draft.isDirty()).toBe(false)
      expect(f.maintenance.hasDirty()).toBe(false)
      expect(f.draft.edit(laterPlan)).toBe(false)
    }
  )

  it('blocks input during central clarification and during the save preflight', async () => {
    const f = fixture()
    f.draft.edit(plan)
    const resolution = f.maintenance.begin()
    expect(f.draft.edit(null)).toBe(false)
    resolution.release()
    let finish!: (value: HexTravelCommandState) => void
    f.port.refresh.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const pending = f.draft.save()
    await vi.waitFor(() => expect(f.port.refresh).toHaveBeenCalledOnce())
    expect(f.draft.edit(laterPlan)).toBe(false)
    expect(await f.draft.save()).toBe(false)
    finish(f.current())
    expect(await pending).toBe(true)
    expect(f.current().routePlan.plan).toEqual(plan)
  })
})
