import { describe, expect, it, vi } from 'vitest'
import {
  CampaignLifecycleCoordinator,
  type CampaignLifecycleConnections,
  type CampaignLifecycleJournal,
  type CampaignLifecycleReceipt,
  type CampaignLifecycleRegistration,
  type CampaignLifecycleStorage
} from '../../src/core/application/campaign-lifecycle-coordinator.js'

const receipt: CampaignLifecycleReceipt = {
  schemaVersion: 2,
  lifecycleId: '00000000-0000-4000-8000-000000000099',
  operation: { kind: 'replacement' },
  mode: 'replace',
  campaignId: '00000000-0000-4000-8000-000000000001',
  previousName: 'Original',
  replacementName: 'Replacement',
  previousActiveId: '00000000-0000-4000-8000-000000000001',
  phase: 'reopened',
  validation: { quickCheck: 'ok' },
  updatedAt: '2026-08-20T00:00:00.000Z'
}

describe('CampaignLifecycleCoordinator recovery', () => {
  it('retains the valid original until registry readback succeeds', () => {
    const fixture = recoveryFixture(false)

    expect(() => fixture.coordinator.recoverPending(false)).toThrow(
      'failed registry readback'
    )
    expect(fixture.events).toEqual([
      'connections-close',
      'commit-marker',
      'current-validation',
      'registry-readback'
    ])
  })

  it('cleans up only after current-store and registry verification', () => {
    const fixture = recoveryFixture(true)

    fixture.coordinator.recoverPending(false)

    expect(fixture.events).toEqual([
      'connections-close',
      'commit-marker',
      'current-validation',
      'registry-readback',
      'cleanup',
      'marker-clear',
      'journal-finish'
    ])
  })
})

function recoveryFixture(registryValid: boolean): {
  coordinator: CampaignLifecycleCoordinator
  events: string[]
} {
  const events: string[] = []
  const journal: CampaignLifecycleJournal = {
    begin: () => receipt,
    advance: () => receipt,
    pending: () => [receipt],
    finish: vi.fn(() => events.push('journal-finish')),
    has: () => true
  }
  const storage: CampaignLifecycleStorage = {
    swap: vi.fn(),
    rollback: vi.fn(),
    isCurrentValid: vi.fn(() => {
      events.push('current-validation')
      return true
    }),
    finalize: vi.fn(() => events.push('cleanup')),
    recoverLegacyReplacement: vi.fn()
  }
  const connections: CampaignLifecycleConnections = {
    release: vi.fn(),
    close: vi.fn(() => events.push('connections-close')),
    reopen: vi.fn()
  }
  const registration: CampaignLifecycleRegistration = {
    commit: vi.fn(),
    isCommitted: vi.fn(() => {
      events.push('commit-marker')
      return true
    }),
    verify: vi.fn(() => {
      events.push('registry-readback')
      return registryValid
    }),
    rollback: vi.fn(),
    clear: vi.fn(() => events.push('marker-clear'))
  }
  return {
    coordinator: new CampaignLifecycleCoordinator({
      journal,
      storage,
      connections,
      registration
    }),
    events
  }
}
