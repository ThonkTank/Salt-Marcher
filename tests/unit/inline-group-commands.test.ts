// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { InlineGroupCommands } from '../../src/renderer/features/session/inline-group-commands.js'
import { CapabilityError } from '../../src/shared/errors/capability-error.js'
import type { SaltMarcherApi } from '../../src/shared/contracts/capability-api.js'
import type { SaveSceneGroupInput } from '../../src/shared/contracts/scene.js'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'
import { maintenanceDraftCoordinator } from '../../src/renderer/shell/maintenance-draft-coordinator.js'

function harness() {
  let group = {
    id: 'group',
    name: 'Keep',
    note: 'Note',
    disposition: 'neutral',
    revision: 1,
    archived: false,
    entries: [
      { creatureId: 'wolf', aliveQuantity: 2, deadQuantity: 1 },
      { creatureId: 'goblin', aliveQuantity: 1, deadQuantity: 0 }
    ]
  }
  const read = vi.fn(() =>
    Promise.resolve({
      revision: group.revision,
      scene: {
        revision: group.revision,
        scenes: [{ id: 'scene', groups: [structuredClone(group)] }]
      }
    } as unknown as LiveSessionSnapshot)
  )
  const save = vi.fn((request: SaveSceneGroupInput) => {
    group = {
      ...group,
      revision: group.revision + 1,
      entries: request.entries.map((e) => ({
        creatureId: e.creatureId,
        aliveQuantity: e.quantity,
        deadQuantity: e.deadQuantity ?? 0
      }))
    }
    return Promise.resolve({})
  })
  const receipt = vi.fn(() => Promise.resolve(null))
  const api = {
    session: { read },
    scene: { saveGroup: save, groupSaveReceipt: receipt }
  } as unknown as SaltMarcherApi
  const applied = vi.fn(),
    commands = new InlineGroupCommands(api, 'campaign', 'scene', applied)
  return { commands, save, receipt, applied, group: () => group }
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
describe('inline Scene quantities', () => {
  it('serializes rapid changes using the latest revision and preserves dead quantities and metadata', async () => {
    const h = harness()
    h.commands.enqueue('group', 'wolf', 1)
    h.commands.enqueue('group', 'wolf', 1)
    h.commands.enqueue('group', 'goblin', null)
    await settle()
    expect(h.save.mock.calls.map(([r]) => r.expectedGroupRevision)).toEqual([
      1, 2, 3
    ])
    expect(h.group().entries).toEqual([
      { creatureId: 'wolf', aliveQuantity: 4, deadQuantity: 1 }
    ])
    expect(
      h.save.mock.calls.every(
        ([r]) =>
          r.name === 'Keep' && r.note === 'Note' && r.disposition === 'neutral'
      )
    ).toBe(true)
    expect(h.commands.snapshot().held).toEqual([])
  })
  it('retains failed intent and retries the exact command instead of losing the requested quantity', async () => {
    const h = harness()
    h.save.mockRejectedValueOnce(new CapabilityError('internal', true))
    h.commands.enqueue('group', 'wolf', 1)
    await settle()
    expect(h.commands.snapshot().held).toEqual(['group'])
    const request = h.save.mock.calls[0]![0]
    expect(await h.commands.retry('group')).toBe(true)
    expect(h.save.mock.calls[1]![0]).toEqual(request)
    expect(h.group().entries[0]?.aliveQuantity).toBe(3)
  })
  it('rebuilds a rejected stale request against current revisions when explicitly retried', async () => {
    const h = harness()
    h.save.mockRejectedValueOnce(new CapabilityError('stale', true))
    h.commands.enqueue('group', 'wolf', 1)
    await settle()
    const request = h.save.mock.calls[0]![0]
    expect(await h.commands.retry('group')).toBe(true)
    expect(h.save.mock.calls[1]![0].commandId).not.toBe(request.commandId)
    expect(h.group().entries[0]?.aliveQuantity).toBe(3)
  })
  it('recovers unknown writes from a receipt before draining later changes', async () => {
    const h = harness()
    h.save.mockRejectedValueOnce(new CapabilityError('outcome_unknown', true))
    h.commands.enqueue('group', 'wolf', 1)
    await settle()
    h.receipt.mockResolvedValueOnce({} as never)
    expect(await h.commands.retry('group')).toBe(true)
    expect(h.save).toHaveBeenCalledTimes(1)
    expect(h.commands.snapshot().held).toEqual([])
  })
  it('does not block an unrelated group through draft coordination', async () => {
    const h = harness()
    h.save.mockRejectedValueOnce(new Error('save failed'))
    h.commands.enqueue('group', 'wolf', 1)
    await settle()
    expect(
      maintenanceDraftCoordinator.hasDirty({
        kind: 'concerns',
        concerns: ['group:unrelated']
      })
    ).toBe(false)
    expect(
      maintenanceDraftCoordinator.hasDirty({
        kind: 'concerns',
        concerns: ['group:group']
      })
    ).toBe(true)
    expect(await h.commands.discard('group')).toBe(true)
  })
})
