// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { SceneCommandController } from '../../src/renderer/features/session/scene-command-controller.js'
import { MaintenanceDraftCoordinator } from '../../src/renderer/shell/maintenance-draft-coordinator.js'
import type { SceneCommand } from '../../src/shared/contracts/scene-command.js'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'
import type { SceneCommandReceipt } from '../../src/shared/contracts/scene-command.js'
function snapshot(revision: number | null) {
  return {
    scene: {
      focusedSceneId: 'scene',
      revision: revision ?? 0,
      scenes: [{ id: 'scene', groups: [{ id: 'group', revision: 7 }] }]
    },
    combat: revision === null ? null : { revision }
  } as unknown as LiveSessionSnapshot
}
function command(kind: 'focus' | 'set-location'): SceneCommand {
  return {
    commandId: crypto.randomUUID(),
    command:
      kind === 'focus'
        ? {
            kind,
            input: {
              sceneId: 'destination',
              sourceSceneId: 'scene',
              expectedRevision: 7
            }
          }
        : {
            kind,
            input: {
              sceneId: 'scene',
              locationId: 'location',
              expectedRevision: 7
            }
          }
  }
}
function fixture() {
  const receipt = {
    snapshot: snapshot(8)
  } as unknown as SceneCommandReceipt
  const current = snapshot(10)
  const port = {
    execute: vi.fn().mockRejectedValue(new Error('lost')),
    status: vi.fn().mockResolvedValue({ receipt, snapshot: current }),
    refresh: vi.fn().mockResolvedValue(current)
  }
  const maintenance = new MaintenanceDraftCoordinator()
  const controller = new SceneCommandController(port, maintenance)
  const complete = vi.fn()
  controller.attach(complete)
  return { controller, port, maintenance, complete, receipt, current }
}
it.each(['focus', 'set-location'] as const)(
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
  'holds an absent scene command at revision %s until explicit resolution',
  async (revision) => {
    const f = fixture()
    await f.controller.execute(command('set-location'))
    f.port.status.mockResolvedValue({
      receipt: null,
      snapshot: snapshot(revision)
    })
    f.port.refresh.mockResolvedValue(snapshot(revision))
    await f.controller.settle()
    expect(f.controller.snapshot().conflict).toBe(revision !== 7)
    expect(f.controller.held()).toBe(true)
    expect(await f.controller.execute(command('focus'))).toBe(false)
    expect(f.port.execute).toHaveBeenCalledOnce()
    expect(await f.controller.discard()).toBe(true)
    expect(f.controller.held()).toBe(false)
  }
)
it.each(['save', 'discard'] as const)(
  'retains a detached original for explicit %s after proven absence',
  async (choice) => {
    const f = fixture()
    const original = command('set-location')
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
      const next = f.port.execute.mock.lastCall?.[0] as SceneCommand
      expect(next.commandId).not.toBe(original.commandId)
      expect(next.command).toEqual(original.command)
    }
  }
)
it('retains a successful write through refresh failure and failed read attempts', async () => {
  const f = fixture()
  f.port.execute.mockResolvedValue(f.receipt)
  f.port.refresh.mockRejectedValueOnce(new Error('refresh'))
  await f.controller.execute(command('set-location'))
  f.controller.detach()
  f.port.status.mockRejectedValueOnce(new Error('offline'))
  expect(await f.controller.discard()).toBe(false)
  expect(f.maintenance.hasDirty()).toBe(true)
  expect(await f.controller.discard()).toBe(true)
  expect(f.port.execute).toHaveBeenCalledOnce()
  expect(f.maintenance.hasDirty()).toBe(false)
})
it('detects a changed scene between status and refresh', async () => {
  const f = fixture()
  await f.controller.execute(command('focus'))
  f.port.status.mockResolvedValue({ receipt: null, snapshot: snapshot(7) })
  await f.controller.settle()
  expect(f.controller.snapshot().conflict).toBe(true)
  await expect(f.controller.save()).rejects.toThrow('Szene')
  expect(f.port.execute).toHaveBeenCalledOnce()
})

it.each(['focus', 'set-location'] as const)(
  'requires the original focus for retrying an absent %s',
  async (kind) => {
    const f = fixture()
    await f.controller.execute(command(kind))
    const base = snapshot(7)
    const changed = {
      ...base,
      scene: { ...base.scene, focusedSceneId: 'other' }
    }
    f.port.status.mockResolvedValue({ receipt: null, snapshot: changed })
    f.port.refresh.mockResolvedValue(changed)
    await f.controller.settle()
    expect(f.controller.snapshot().conflict).toBe(true)
    await expect(f.controller.save()).rejects.toThrow('Szene')
    expect(f.port.execute).toHaveBeenCalledOnce()
  }
)
