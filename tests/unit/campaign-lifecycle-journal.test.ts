import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { FileCampaignLifecycleJournal } from '../../src/core/persistence/sqlite/campaign-lifecycle-journal.js'

const roots: string[] = []
const campaignId = '00000000-0000-4000-8000-000000000001'

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('FileCampaignLifecycleJournal', () => {
  it('persists only monotonic phases from staged through finalized', () => {
    const root = fixture()
    const journal = new FileCampaignLifecycleJournal(root)
    let receipt = journal.begin({
      operation: { kind: 'replacement' },
      mode: 'replace',
      campaignId,
      previousName: 'Original',
      replacementName: 'Replacement',
      previousActiveId: campaignId
    })
    for (const phase of [
      'validated',
      'swapped',
      'reopened',
      'registered',
      'verified',
      'finalized'
    ] as const)
      receipt = journal.advance(receipt, phase, {
        quickCheck: phase === 'validated' ? 'ok' : undefined
      })

    expect(journal.pending()).toEqual([receipt])
    expect(() => journal.advance(receipt, 'verified')).toThrow('cannot advance')
    journal.finish(receipt)
    expect(journal.pending()).toEqual([])
  })

  it('rejects an obsolete schema-1 receipt without rewriting it', () => {
    const root = fixture()
    const directory = join(root, 'campaigns', '.transitions')
    const path = join(directory, `${campaignId}.json`)
    mkdirSync(directory, { recursive: true })
    const legacy = JSON.stringify({
      schemaVersion: 1,
      transitionId: '00000000-0000-4000-8000-000000000099',
      campaignId,
      previousName: 'Original',
      replacementName: 'Replacement',
      previousActiveId: campaignId,
      phase: 'staged',
      updatedAt: '2026-08-20T00:00:00.000Z'
    })
    writeFileSync(path, legacy)

    expect(() => new FileCampaignLifecycleJournal(root).pending()).toThrow(
      'Unsupported campaignLifecycleReceipt schemaVersion 1; expected 2'
    )
    expect(readFileSync(path, 'utf8')).toBe(legacy)
  })
})

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'salt-marcher-lifecycle-journal-'))
  roots.push(root)
  return root
}
