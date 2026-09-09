// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { CharacterCommandController } from '../../src/renderer/features/party/character-command-controller.js'
import { MaintenanceDraftCoordinator } from '../../src/renderer/shell/maintenance-draft-coordinator.js'
import {
  partyCharacterDraftSchema,
  type PartyCharacterCommand,
  type PartySnapshot
} from '../../src/shared/contracts/party.js'
import type { LiveSessionSnapshot } from '../../src/shared/contracts/live-session.js'

const characterId = '01900000-0000-7000-8000-000000000201'
const draft = partyCharacterDraftSchema.parse({
  name: 'Edrik',
  playerName: null,
  level: null,
  passivePerception: null,
  armorClass: null
})
const party: PartySnapshot = {
  revision: 7,
  members: [],
  adventuringDay: {
    available: false,
    partySize: 0,
    dailyBudget: 0,
    shortRestXp: 0,
    longRestXp: 0
  }
}
function command(kind: 'create' | 'update' | 'delete'): PartyCharacterCommand {
  return {
    commandId: crypto.randomUUID(),
    command:
      kind === 'create'
        ? { kind, input: { character: draft, expectedRevision: 7 } }
        : kind === 'update'
          ? {
              kind,
              input: { id: characterId, character: draft, expectedRevision: 7 }
            }
          : { kind, input: { id: characterId, expectedRevision: 7 } }
  }
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
function fixture() {
  const receipt = { characterId, party: { ...party, revision: 8 } }
  // The later session deliberately no longer contains the affected character.
  const current = { party: { ...party, revision: 10 } } as LiveSessionSnapshot
  const port = {
    execute: vi.fn().mockResolvedValue(receipt),
    status: vi.fn().mockResolvedValue({ receipt, party: current.party }),
    refresh: vi.fn().mockResolvedValue(current)
  }
  const maintenance = new MaintenanceDraftCoordinator()
  const controller = new CharacterCommandController(port, maintenance)
  const complete = vi.fn()
  controller.attach(complete)
  return { controller, maintenance, port, complete, receipt, current }
}

describe('Character command lifecycle and read recovery', () => {
  it.each(['create', 'update', 'delete'] as const)(
    'recovers %s using its original receipt and current session without replay',
    async (kind) => {
      const f = fixture()
      const input = command(kind)
      f.port.execute.mockRejectedValue(new Error('lost response'))
      expect(await f.controller.execute(input)).toBe(false)
      expect(f.controller.snapshot().uncertain).toBe(true)
      expect(await f.controller.execute(command(kind))).toBe(false)
      expect(await f.controller.settle()).toBe(true)
      expect(f.port.status).toHaveBeenCalledWith(input)
      expect(f.port.execute).toHaveBeenCalledOnce()
      expect(f.complete).toHaveBeenCalledWith(f.receipt, f.current)
      expect(f.complete.mock.calls[0]?.[1]).not.toBe(f.receipt.party)
      expect(f.controller.unresolved()).toBe(false)
    }
  )

  it('retains a copy of the original command when caller data changes', async () => {
    const f = fixture()
    const input = command('delete')
    const original = structuredClone(input)
    f.port.execute.mockRejectedValue(new Error('lost'))
    const saving = f.controller.execute(input)
    input.command.input.expectedRevision = 99
    await saving
    await f.controller.settle()
    expect(f.port.execute).toHaveBeenCalledWith(original)
    expect(f.port.status).toHaveBeenCalledWith(original)
  })

  it('retains ownership through the full refresh and suppresses duplicate writes', async () => {
    const f = fixture()
    const refresh = deferred<LiveSessionSnapshot>()
    f.port.refresh.mockReturnValue(refresh.promise)
    const saving = f.controller.execute(command('create'))
    await Promise.resolve()
    expect(await f.controller.execute(command('create'))).toBe(false)
    expect(f.controller.unresolved()).toBe(true)
    expect(f.controller.snapshot().busy).toBe(true)
    expect(f.complete).not.toHaveBeenCalled()
    refresh.resolve(f.current)
    expect(await saving).toBe(true)
    expect(f.complete).toHaveBeenCalledOnce()
    expect(f.port.execute).toHaveBeenCalledOnce()
  })

  it('holds a confirmed write when refresh fails and tolerates repeated read failures', async () => {
    const f = fixture()
    f.port.refresh.mockRejectedValueOnce(new Error('refresh failed'))
    expect(await f.controller.execute(command('update'))).toBe(false)
    f.port.status
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'))
    expect(await f.controller.settle()).toBe(false)
    expect(await f.controller.settle()).toBe(false)
    expect(f.controller.reset()).toBe(false)
    expect(f.controller.unresolved()).toBe(true)
    expect(await f.controller.settle()).toBe(true)
    expect(f.port.execute).toHaveBeenCalledOnce()
    expect(f.complete).toHaveBeenCalledOnce()
  })

  it.each([7, 9])(
    'preserves an absent command and detects revision %i',
    async (revision) => {
      const f = fixture()
      f.port.execute.mockRejectedValue(new Error('lost'))
      await f.controller.execute(command('update'))
      f.port.status.mockResolvedValue({
        receipt: null,
        party: { ...party, revision }
      })
      f.port.refresh.mockResolvedValue({ party: { ...party, revision } })
      expect(await f.controller.settle()).toBe(true)
      expect(f.complete).not.toHaveBeenCalled()
      expect(f.controller.snapshot().conflict).toBe(revision !== 7)
      if (revision !== 7) {
        expect(await f.controller.execute(command('update'))).toBe(false)
        expect(f.port.execute).toHaveBeenCalledOnce()
      }
      expect(f.controller.reset()).toBe(true)
    }
  )

  it('detects changes between absent status and fresh session', async () => {
    const f = fixture()
    f.port.execute.mockRejectedValue(new Error('lost'))
    await f.controller.execute(command('create'))
    f.port.status.mockResolvedValue({ receipt: null, party })
    await f.controller.settle()
    expect(f.controller.snapshot().conflict).toBe(true)
    expect(f.complete).not.toHaveBeenCalled()
  })

  it.each(['save', 'discard'] as const)(
    'retains a detached pending write for central %s without late navigation',
    async (choice) => {
      const f = fixture()
      const write = deferred<typeof f.receipt>()
      f.port.execute.mockReturnValue(write.promise)
      const saving = f.controller.execute(command('delete'))
      f.controller.detach()
      expect(f.maintenance.hasDirty()).toBe(true)
      const resolution = f.maintenance.begin()
      let finished = false
      const resolving = resolution.resolve(choice).then((value) => {
        finished = true
        return value
      })
      await Promise.resolve()
      expect(finished).toBe(false)
      write.resolve(f.receipt)
      expect(await saving).toBe(true)
      expect(await resolving).toEqual([])
      resolution.release()
      expect(f.complete).not.toHaveBeenCalled()
      expect(f.maintenance.hasDirty()).toBe(false)
      expect(f.port.execute).toHaveBeenCalledOnce()
    }
  )

  it('keeps a detached unknown attempt registered across failed maintenance and removes it after recovery', async () => {
    const f = fixture()
    f.port.execute.mockRejectedValue(new Error('lost'))
    await f.controller.execute(command('create'))
    f.controller.detach()
    f.port.status.mockRejectedValueOnce(new Error('offline'))
    const resolution = f.maintenance.begin()
    expect(await resolution.resolve('discard')).toHaveLength(1)
    expect(f.maintenance.hasDirty()).toBe(true)
    expect(await resolution.resolve('discard')).toEqual([])
    resolution.release()
    expect(f.maintenance.hasDirty()).toBe(false)
    expect(f.complete).not.toHaveBeenCalled()
    expect(f.port.execute).toHaveBeenCalledOnce()
  })

  it.each(['save', 'discard'] as const)(
    'keeps a detached absent draft until explicit %s',
    async (choice) => {
      const f = fixture()
      const original = command('create')
      f.port.execute.mockRejectedValueOnce(new Error('lost'))
      await f.controller.execute(original)
      f.controller.detach()
      f.port.status.mockResolvedValue({ receipt: null, party })
      f.port.refresh.mockResolvedValueOnce({ ...f.current, party })
      expect(await f.controller.settle()).toBe(true)
      expect(f.controller.unresolved()).toBe(false)
      expect(f.maintenance.hasDirty()).toBe(true)
      expect(f.port.execute).toHaveBeenCalledOnce()
      const resolution = f.maintenance.begin()
      expect(await resolution.resolve(choice)).toEqual([])
      resolution.release()
      expect(f.maintenance.hasDirty()).toBe(false)
      expect(f.complete).not.toHaveBeenCalled()
      expect(f.port.execute).toHaveBeenCalledTimes(choice === 'save' ? 2 : 1)
      if (choice === 'save') {
        const next = f.port.execute.mock.calls[1]?.[0] as PartyCharacterCommand
        expect(next.commandId).not.toBe(original.commandId)
        expect(next.command).toEqual(original.command)
      }
    }
  )

  it('retains an absent draft after mounted read recovery followed by detach', async () => {
    const f = fixture()
    f.port.execute.mockRejectedValueOnce(new Error('lost'))
    await f.controller.execute(command('update'))
    f.port.status.mockResolvedValue({ receipt: null, party })
    f.port.refresh.mockResolvedValue({ ...f.current, party })
    await f.controller.settle()
    f.controller.detach()
    expect(f.maintenance.hasDirty()).toBe(true)
    const resolution = f.maintenance.begin()
    expect(await resolution.resolve('discard')).toEqual([])
    resolution.release()
    expect(f.port.execute).toHaveBeenCalledOnce()
    expect(f.maintenance.hasDirty()).toBe(false)
  })

  it('preserves a detached conflicting draft through repeated save attempts until discard', async () => {
    const f = fixture()
    f.port.execute.mockRejectedValueOnce(new Error('lost'))
    await f.controller.execute(command('update'))
    f.controller.detach()
    f.port.status.mockResolvedValue({ receipt: null, party: f.current.party })
    const resolution = f.maintenance.begin()
    for (let attempt = 0; attempt < 2; attempt++) {
      const failures = await resolution.resolve('save')
      expect(failures).toHaveLength(1)
      expect(failures[0]?.message).toContain('inzwischen geändert')
      expect(f.maintenance.hasDirty()).toBe(true)
    }
    expect(f.port.execute).toHaveBeenCalledOnce()
    expect(await resolution.resolve('discard')).toEqual([])
    resolution.release()
    expect(f.maintenance.hasDirty()).toBe(false)
  })

  it('does not submit a detached draft until absence can be read and retains a lost new answer', async () => {
    const f = fixture()
    const original = command('delete')
    f.port.execute.mockRejectedValue(new Error('lost'))
    await f.controller.execute(original)
    f.controller.detach()
    f.port.status
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ receipt: null, party })
    f.port.refresh.mockResolvedValueOnce({ ...f.current, party })
    const resolution = f.maintenance.begin()
    expect(await resolution.resolve('save')).toHaveLength(1)
    expect(f.port.execute).toHaveBeenCalledOnce()
    expect(await resolution.resolve('save')).toHaveLength(1)
    expect(f.port.execute).toHaveBeenCalledTimes(2)
    const next = f.port.execute.mock.calls[1]?.[0] as PartyCharacterCommand
    expect(next.commandId).not.toBe(original.commandId)
    // The next status belongs to the explicitly authorized new attempt.
    expect(await resolution.resolve('discard')).toEqual([])
    resolution.release()
    expect(f.port.status).toHaveBeenLastCalledWith(next)
    expect(f.port.execute).toHaveBeenCalledTimes(2)
    expect(f.maintenance.hasDirty()).toBe(false)
  })

  it('returns ownership to the mounted view and uses only its current completion callback', async () => {
    const f = fixture()
    f.port.execute.mockRejectedValue(new Error('lost'))
    await f.controller.execute(command('create'))
    f.controller.detach()
    const returned = vi.fn()
    f.controller.attach(returned)
    expect(f.maintenance.hasDirty()).toBe(false)
    expect(f.controller.unresolved()).toBe(true)
    await f.controller.settle()
    expect(returned).toHaveBeenCalledWith(f.receipt, f.current)
    expect(f.complete).not.toHaveBeenCalled()
  })
})
