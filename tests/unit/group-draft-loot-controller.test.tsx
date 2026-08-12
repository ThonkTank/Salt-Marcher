// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { CapabilityProvider } from '../../src/renderer/capabilities/capability-provider.js'
import { useGroupDraftLootController } from '../../src/renderer/features/session/use-group-draft-loot-controller.js'
import type { SaltMarcherApi } from '../../src/shared/contracts/capability-api.js'
import type { GenerateGroupDraftLootInput } from '../../src/shared/contracts/loot.js'
import type { GroupRewardGeneratedRun } from '../../src/shared/contracts/session-generation.js'

afterEach(cleanup)

const sceneId = '01900000-0000-7000-8000-000000000001'
const groupId = '01900000-0000-7000-8000-000000000002'

describe('group draft Loot controller', () => {
  it('generates from the full draft, rerolls only Loot, and invalidates the preview', async () => {
    const generated = generatedRun()
    const requests: GenerateGroupDraftLootInput[] = []
    const generateForGroupDraft = vi.fn(
      (request: GenerateGroupDraftLootInput) => {
        requests.push(request)
        return Promise.resolve({ run: generated })
      }
    )
    const api = {
      runtime: { e2e: true },
      campaignRules: { read: vi.fn().mockResolvedValue({ revision: 7 }) },
      loot: {
        generateForGroupDraft,
        commitGroupReward: vi.fn()
      }
    } as unknown as SaltMarcherApi
    Object.defineProperty(window, 'saltMarcher', {
      configurable: true,
      value: api
    })

    render(
      <CapabilityProvider api={api}>
        <Harness />
      </CapabilityProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'generate' }))
    await screen.findByText(generated.id)
    const firstRequest = requests[0]!
    expect(firstRequest).toMatchObject({
      sceneId,
      groupId,
      expectedGroupRevision: null,
      expectedSceneRevision: 4,
      expectedPartyRevision: 5,
      expectedCampaignRulesRevision: 7,
      entries: [{ creatureId: 'wolf', quantity: 2, deadQuantity: 1 }]
    })

    fireEvent.click(screen.getByRole('button', { name: 'reroll' }))
    await waitFor(() => expect(generateForGroupDraft).toHaveBeenCalledTimes(2))
    expect(requests[1]!.seed).not.toBe(firstRequest.seed)
    expect(requests[1]!.entries).toEqual(firstRequest.entries)

    fireEvent.click(screen.getByRole('button', { name: 'invalidate' }))
    expect(screen.queryByText(generated.id)).toBeNull()
  })

  it('caches edited drafts per group and restores their undo history', async () => {
    const generated = generatedRun()
    const api = {
      runtime: { e2e: true },
      campaignRules: { read: vi.fn().mockResolvedValue({ revision: 7 }) },
      loot: {
        generateForGroupDraft: vi.fn().mockResolvedValue({ run: generated }),
        commitGroupReward: vi.fn()
      }
    } as unknown as SaltMarcherApi
    render(
      <CapabilityProvider api={api}>
        <CachingHarness />
      </CapabilityProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'generate' }))
    await screen.findByText('Fund 1 · Encounter 1')
    fireEvent.click(screen.getByRole('button', { name: 'edit label' }))
    expect(screen.getByText('Bearbeiteter Fund')).toBeTruthy()
    expect(screen.getByText('dirty')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'switch group' }))
    expect(screen.queryByText('Bearbeiteter Fund')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'switch group' }))
    expect(screen.getByText('Bearbeiteter Fund')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'undo loot' }))
    expect(screen.getByText('Fund 1 · Encounter 1')).toBeTruthy()
  })
})

function Harness() {
  const controller = useGroupDraftLootController({
    draftKey: 'new',
    sceneId,
    groupId,
    expectedSceneRevision: 4,
    expectedGroupRevision: null,
    expectedPartyRevision: 5,
    entries: [{ creatureId: 'wolf', quantity: 2, deadQuantity: 1 }]
  })
  return (
    <div>
      <button type="button" onClick={() => void controller.generate()}>
        generate
      </button>
      <button type="button" onClick={() => void controller.reroll()}>
        reroll
      </button>
      <button type="button" onClick={controller.invalidate}>
        invalidate
      </button>
      {controller.run && <span>{controller.run.id}</span>}
    </div>
  )
}

function CachingHarness() {
  const [key, setKey] = useState('group-a')
  const controller = useGroupDraftLootController({
    draftKey: key,
    sceneId,
    groupId,
    expectedSceneRevision: 4,
    expectedGroupRevision: null,
    expectedPartyRevision: 5,
    entries: [{ creatureId: 'wolf', quantity: 2, deadQuantity: 1 }]
  })
  return (
    <div>
      <button type="button" onClick={() => void controller.generate()}>
        generate
      </button>
      <button
        type="button"
        onClick={() => controller.patchLabel('Bearbeiteter Fund')}
      >
        edit label
      </button>
      <button
        type="button"
        onClick={() =>
          setKey((current) => (current === 'group-a' ? 'group-b' : 'group-a'))
        }
      >
        switch group
      </button>
      <button type="button" onClick={controller.undo}>
        undo loot
      </button>
      {controller.draft && <span>{controller.draft.label}</span>}
      {controller.dirty && <span>dirty</span>}
    </div>
  )
}

function generatedRun(): GroupRewardGeneratedRun {
  return {
    id: '01900000-0000-7000-8000-000000000010',
    treasures: [
      {
        id: 'generated:treasure:1',
        rewardChannel: 'encounter',
        anchorEncounterNumber: 1,
        containers: [],
        items: [
          {
            id: 'generated:item:1',
            catalogItemId: 'item:test',
            name: 'Test item',
            quantity: 1,
            unitValueCp: 10,
            stackable: false,
            magic: false,
            rarity: null,
            curseName: null,
            containerId: null
          }
        ]
      }
    ]
  } as unknown as GroupRewardGeneratedRun
}
