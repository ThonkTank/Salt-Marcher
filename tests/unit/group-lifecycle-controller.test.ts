// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { GroupLifecycleController } from '../../src/renderer/features/session/group-lifecycle-controller.js'
import { MaintenanceDraftCoordinator } from '../../src/renderer/shell/maintenance-draft-coordinator.js'
import type { SceneGroupLifecycleCommand } from '../../src/shared/contracts/scene-group-lifecycle.js'
import type {
  LiveSessionSnapshot,
  SceneGroupCommandResult
} from '../../src/shared/contracts/live-session.js'
function snapshot(revision: number | null) {
  return {
    scene: {
      scenes: [
        {
          id: 'scene',
          groups: revision === null ? [] : [{ id: 'group', revision }]
        }
      ]
    }
  } as unknown as LiveSessionSnapshot
}
function command(
  kind: 'archive' | 'restore' | 'delete'
): SceneGroupLifecycleCommand {
  const input = { sceneId: 'scene', groupId: 'group', expectedGroupRevision: 7 }
  return {
    commandId: crypto.randomUUID(),
    command:
      kind === 'delete'
        ? { kind, input }
        : { kind: 'archive', input: { ...input, archived: kind === 'archive' } }
  }
}
function fixture() {
  const receipt = {
    scenePatch: { revision: 8 },
    combat: null
  } as unknown as SceneGroupCommandResult
  const current = snapshot(10)
  const port = {
    execute: vi.fn().mockRejectedValue(new Error('lost')),
    status: vi.fn().mockResolvedValue({ receipt, snapshot: current }),
    refresh: vi.fn().mockResolvedValue(current)
  }
  const maintenance = new MaintenanceDraftCoordinator()
  const controller = new GroupLifecycleController(port, maintenance)
  const complete = vi.fn()
  controller.attach(complete)
  return { controller, port, maintenance, complete, receipt, current }
}
it.each(['archive', 'restore', 'delete'] as const)(
  'recovers original %s without replay or overwriting later work',
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
it.each([7, 9, null])(
  'holds an absent group command at revision %s until explicit resolution',
  async (revision) => {
    const f = fixture()
    await f.controller.execute(command('delete'))
    f.port.status.mockResolvedValue({
      receipt: null,
      snapshot: snapshot(revision)
    })
    f.port.refresh.mockResolvedValue(snapshot(revision))
    await f.controller.settle()
    expect(f.controller.snapshot().conflict).toBe(revision !== 7)
    expect(f.controller.held()).toBe(true)
    expect(await f.controller.execute(command('restore'))).toBe(false)
    expect(f.port.execute).toHaveBeenCalledOnce()
    expect(await f.controller.discard()).toBe(true)
    expect(f.controller.held()).toBe(false)
  }
)
it.each(['save', 'discard'] as const)(
  'retains a detached original for explicit %s after proven absence',
  async (choice) => {
    const f = fixture()
    const original = command('archive')
    await f.controller.execute(original)
    f.controller.detach()
    f.port.status.mockResolvedValue({ receipt: null, snapshot: snapshot(7) })
    f.port.refresh.mockResolvedValue(snapshot(7))
    f.port.execute.mockResolvedValue(f.receipt)
    const resolution = f.maintenance.begin()
    expect(await resolution.resolve(choice)).toEqual([])
    resolution.release()
    expect(f.port.execute).toHaveBeenCalledTimes(choice === 'save' ? 2 : 1)
    expect(f.complete).not.toHaveBeenCalled()
    expect(f.maintenance.hasDirty()).toBe(false)
    if (choice === 'save') {
      const next = f.port.execute.mock
        .lastCall?.[0] as SceneGroupLifecycleCommand
      expect(next.commandId).not.toBe(original.commandId)
      expect(next.command).toEqual(original.command)
    }
  }
)
it('retains a successful write through refresh failure and failed read attempts', async () => {
  const f = fixture()
  f.port.execute.mockResolvedValue(f.receipt)
  f.port.refresh.mockRejectedValueOnce(new Error('refresh'))
  await f.controller.execute(command('delete'))
  f.controller.detach()
  f.port.status.mockRejectedValueOnce(new Error('offline'))
  expect(await f.controller.discard()).toBe(false)
  expect(f.maintenance.hasDirty()).toBe(true)
  expect(await f.controller.discard()).toBe(true)
  expect(f.port.execute).toHaveBeenCalledOnce()
  expect(f.maintenance.hasDirty()).toBe(false)
})
it('detects a changed group between status and refresh', async () => {
  const f = fixture()
  await f.controller.execute(command('restore'))
  f.port.status.mockResolvedValue({ receipt: null, snapshot: snapshot(7) })
  await f.controller.settle()
  expect(f.controller.snapshot().conflict).toBe(true)
  await expect(f.controller.save()).rejects.toThrow('Gruppe')
  expect(f.port.execute).toHaveBeenCalledOnce()
})
