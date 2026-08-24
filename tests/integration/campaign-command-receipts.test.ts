import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CampaignStore } from '../../src/core/persistence/sqlite/campaign-store.js'
import { CapabilityError } from '../../src/shared/errors/capability-error.js'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('Campaign command receipts', () => {
  it('persists exact idempotent receipts for every lifecycle command', () => {
    const root = temporaryRoot()
    const store = new CampaignStore(root)
    const receipts = []
    const createA = {
      commandId: '00000000-0000-4000-8000-000000000201',
      expectedRegistryRevision: 0,
      name: 'Campaign A'
    }
    const createdA = store.create(createA)
    receipts.push(createdA)
    expect(store.create(createA)).toEqual(createdA)
    const campaignA = createdA.campaignId

    const createB = {
      commandId: '00000000-0000-4000-8000-000000000202',
      expectedRegistryRevision: 1,
      name: 'Campaign B'
    }
    const createdB = store.create(createB)
    receipts.push(createdB)
    expect(store.create(createB)).toEqual(createdB)

    const activate = {
      commandId: '00000000-0000-4000-8000-000000000203',
      expectedRegistryRevision: 2,
      id: campaignA
    }
    const activated = store.activate(activate)
    receipts.push(activated)
    expect(store.activate(activate)).toEqual(activated)

    const rename = {
      commandId: '00000000-0000-4000-8000-000000000204',
      expectedRegistryRevision: 3,
      id: campaignA,
      name: 'Campaign A renamed'
    }
    const renamed = store.rename(rename)
    receipts.push(renamed)
    expect(store.rename(rename)).toEqual(renamed)

    const trash = {
      commandId: '00000000-0000-4000-8000-000000000205',
      expectedRegistryRevision: 4,
      id: campaignA
    }
    const trashed = store.trash(trash)
    receipts.push(trashed)
    expect(store.trash(trash)).toEqual(trashed)

    const restore = {
      commandId: '00000000-0000-4000-8000-000000000206',
      expectedRegistryRevision: 5,
      id: campaignA
    }
    const restored = store.restore(restore)
    receipts.push(restored)
    expect(store.restore(restore)).toEqual(restored)

    const trashAgain = {
      commandId: '00000000-0000-4000-8000-000000000207',
      expectedRegistryRevision: 6,
      id: campaignA
    }
    const trashedAgain = store.trash(trashAgain)
    receipts.push(trashedAgain)
    const remove = {
      commandId: '00000000-0000-4000-8000-000000000208',
      expectedRegistryRevision: 7,
      id: campaignA,
      confirmationName: 'Campaign A renamed'
    }
    const deleted = store.deleteForever(remove)
    receipts.push(deleted)
    expect(store.deleteForever(remove)).toEqual(deleted)
    expect(deleted.snapshot).toMatchObject({
      revision: 8,
      campaigns: [{ id: createdB.campaignId }],
      trashedCampaigns: []
    })
    expect(() =>
      store.rename({
        ...rename,
        commandId: createA.commandId,
        expectedRegistryRevision: 8
      })
    ).toThrowError(new CapabilityError('idempotency_conflict', false))
    for (const receipt of receipts) {
      expect(store.commandReceipt(receipt.commandId)).toEqual(receipt)
      expect(Object.isFrozen(receipt)).toBe(true)
      expect(Object.isFrozen(receipt.snapshot)).toBe(true)
    }
    store.close()

    const reopened = new CampaignStore(root)
    for (const receipt of receipts)
      expect(reopened.commandReceipt(receipt.commandId)).toEqual(receipt)
    reopened.close()
  })

  it.each(['after-store-created', 'before-ready'] as const)(
    'recovers strict creation after %s under the original command identity',
    (phase) => {
      const root = temporaryRoot()
      const command = {
        commandId: '00000000-0000-4000-8000-000000000209',
        expectedRegistryRevision: 0,
        name: 'Receipt Recovery'
      }
      const interrupted = new CampaignStore(root, {
        onCreatePhase(currentPhase) {
          if (currentPhase === phase)
            throw new Error('simulated process interruption')
        }
      })

      expect(() => interrupted.create(command)).toThrow(
        'simulated process interruption'
      )
      interrupted.close()

      const reopened = new CampaignStore(root)
      const receipt = reopened.commandReceipt(command.commandId)
      expect(receipt).toMatchObject({
        kind: 'created',
        commandId: command.commandId,
        snapshot: {
          revision: 1,
          campaigns: [{ name: command.name }]
        }
      })
      expect(reopened.create(command)).toEqual(receipt)
      reopened.close()
    }
  )
})

function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-command-receipts-'))
  roots.push(root)
  return root
}
