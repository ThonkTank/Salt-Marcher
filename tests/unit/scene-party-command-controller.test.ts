// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { ScenePartyCommandController } from '../../src/renderer/features/scene-desktop/scene-party-command-controller.js'
import type { ScenePartyCommand } from '../../src/shared/contracts/scene-party-command.js'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'
import { MaintenanceDraftCoordinator } from '../../src/renderer/shell/maintenance-draft-coordinator.js'
function snapshot(party = 7, scene = 4) {
  return {
    party: { revision: party },
    scene: { revision: scene }
  } as LiveSessionSnapshot
}
function command(
  kind: 'set-roster' | 'move-roster' | 'rest-selected'
): ScenePartyCommand {
  const input = {
    sceneId: 'scene',
    memberIds: ['member'],
    expectedRevision: 4,
    expectedPartyRevision: 7
  }
  return {
    commandId: crypto.randomUUID(),
    command:
      kind === 'set-roster'
        ? { kind, input }
        : kind === 'move-roster'
          ? {
              kind,
              input: { ...input, target: { kind: 'new', title: 'Destination' } }
            }
          : {
              kind,
              input: {
                sceneId: 'scene',
                memberIds: ['member'],
                type: 'long',
                expectedRevision: 7,
                expectedSceneRevision: 4
              }
            }
  }
}
function fixture() {
  const receipt = { snapshot: snapshot(8, 5) }
  const current = snapshot(11, 9)
  const port = {
    execute: vi.fn().mockRejectedValue(new Error('lost response')),
    status: vi.fn().mockResolvedValue({ receipt, snapshot: current }),
    refresh: vi.fn().mockResolvedValue(current)
  }
  const maintenance = new MaintenanceDraftCoordinator()
  const controller = new ScenePartyCommandController(port, maintenance)
  const complete = vi.fn()
  controller.attach(complete)
  return { controller, port, complete, maintenance, receipt, current }
}
it.each(['set-roster', 'move-roster', 'rest-selected'] as const)(
  'reads the original %s outcome without replaying later work',
  async (kind) => {
    const f = fixture()
    const input = command(kind)
    const original = structuredClone(input)
    expect(await f.controller.execute(input)).toBe(false)
    input.command.input.memberIds.push('later')
    expect(await f.controller.execute(command(kind))).toBe(false)
    expect(await f.controller.settle()).toBe(true)
    expect(f.port.status).toHaveBeenCalledWith(original)
    expect(f.port.execute).toHaveBeenCalledOnce()
    expect(f.complete).toHaveBeenCalledWith(f.receipt, f.current)
  }
)
it.each(['set-roster', 'move-roster', 'rest-selected'] as const)(
  'detects both revision conflicts for absent %s',
  async (kind) => {
    for (const [party, scene] of [
      [8, 4],
      [7, 5],
      [7, 4]
    ]) {
      const f = fixture()
      await f.controller.execute(command(kind))
      const current = snapshot(party, scene)
      f.port.status.mockResolvedValue({ receipt: null, snapshot: current })
      f.port.refresh.mockResolvedValue(current)
      expect(await f.controller.settle()).toBe(true)
      expect(f.controller.snapshot().conflict).toBe(party !== 7 || scene !== 4)
      expect(f.complete).not.toHaveBeenCalled()
      expect(f.port.execute).toHaveBeenCalledOnce()
    }
  }
)
it('holds a confirmed write through failed refresh and repeated failed status reads', async () => {
  const f = fixture()
  f.port.execute.mockResolvedValue(f.receipt)
  f.port.refresh.mockRejectedValueOnce(new Error('refresh'))
  await f.controller.execute(command('move-roster'))
  f.port.status.mockRejectedValueOnce(new Error('offline'))
  expect(await f.controller.settle()).toBe(false)
  expect(f.controller.reset()).toBe(false)
  expect(await f.controller.settle()).toBe(true)
  expect(f.port.execute).toHaveBeenCalledOnce()
})
it.each(['save', 'discard'] as const)(
  'retains an absent detached command until explicit %s',
  async (choice) => {
    const f = fixture()
    const original = command('rest-selected')
    await f.controller.execute(original)
    f.controller.detach()
    f.port.status.mockResolvedValue({ receipt: null, snapshot: snapshot() })
    f.port.refresh.mockResolvedValue(snapshot())
    expect(await f.controller.settle()).toBe(true)
    expect(f.maintenance.hasDirty()).toBe(true)
    f.port.execute.mockResolvedValue(f.receipt)
    const resolution = f.maintenance.begin()
    expect(await resolution.resolve(choice)).toEqual([])
    resolution.release()
    expect(f.complete).not.toHaveBeenCalled()
    expect(f.maintenance.hasDirty()).toBe(false)
    expect(f.port.execute).toHaveBeenCalledTimes(choice === 'save' ? 2 : 1)
    if (choice === 'save') {
      const next = f.port.execute.mock.lastCall?.[0] as ScenePartyCommand
      expect(next.commandId).not.toBe(original.commandId)
      expect(next.command).toEqual(original.command)
    }
  }
)
it('detects changes between absent status and refresh', async () => {
  const f = fixture()
  await f.controller.execute(command('move-roster'))
  f.port.status.mockResolvedValue({ receipt: null, snapshot: snapshot() })
  await f.controller.settle()
  expect(f.controller.snapshot().conflict).toBe(true)
})
