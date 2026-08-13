import { describe, expect, it } from 'vitest'
import type { SceneGroup } from '../../src/shared/contracts/scene.js'
import type { GroupRewardGeneratedRun } from '../../src/shared/contracts/session-generation.js'
import {
  activeGroupSession,
  createGroupManagerState,
  groupManagerReducer
} from '../../src/renderer/features/session/group-manager-state.js'
import { groupDraftStateFromGroup } from '../../src/renderer/features/session/group-draft.js'
import { groupLootDraftFromRun } from '../../src/renderer/features/loot/group-loot-draft.js'
import {
  groupManagerIntentGuard,
  groupManagerIntentNeedsConfirmation,
  type GroupManagerIntent
} from '../../src/renderer/features/session/group-manager-intent.js'
import { groupManagerHistoryShortcut } from '../../src/renderer/features/session/group-manager-shortcuts.js'

describe('group manager state', () => {
  it('owns and restores the complete per-group session cache', () => {
    let state = createGroupManagerState({
      activeKey: 'group-a',
      initialGroup: null,
      prospectiveGroupId: 'prospective',
      locationId: null
    })
    state = groupManagerReducer(state, {
      kind: 'mutate-group',
      mutation: { kind: 'name', update: 'A' }
    })
    state = groupManagerReducer(state, {
      kind: 'activate',
      key: 'group-b',
      fallback: groupDraftStateFromGroup(null),
      sourceRevision: null
    })
    state = groupManagerReducer(state, {
      kind: 'mutate-group',
      mutation: { kind: 'name', update: 'B' }
    })
    state = groupManagerReducer(state, {
      kind: 'activate',
      key: 'group-a',
      fallback: groupDraftStateFromGroup(null),
      sourceRevision: null
    })
    expect(activeGroupSession(state)?.group.name).toBe('A')
    expect(state.sessions['group-b']?.group.name).toBe('B')
  })

  it('invalidates generated Loot centrally for every roster mutation', () => {
    const run = generatedRun()
    let state = createGroupManagerState({
      activeKey: 'group-a',
      initialGroup: null,
      prospectiveGroupId: 'prospective',
      locationId: null
    })
    state = groupManagerReducer(state, {
      kind: 'loot-request-began',
      key: 'group-a',
      token: 'request',
      phase: 'generating'
    })
    state = groupManagerReducer(state, {
      kind: 'loot-generated',
      key: 'group-a',
      token: 'request',
      run,
      draft: groupLootDraftFromRun(run, () => 'draft-item'),
      seed: 1
    })
    expect(activeGroupSession(state)?.loot.run).toBe(run)
    state = groupManagerReducer(state, {
      kind: 'mutate-group',
      mutation: {
        kind: 'roster',
        update: { quantities: { wolf: 1 }, deadQuantities: {} }
      }
    })
    expect(activeGroupSession(state)?.loot.run).toBeNull()
  })

  it('ignores stale async results by request token and draft key', () => {
    let state = createGroupManagerState({
      activeKey: 'group-a',
      initialGroup: null,
      prospectiveGroupId: 'prospective',
      locationId: null
    })
    state = groupManagerReducer(state, {
      kind: 'request-began',
      request: 'evaluation',
      token: 'new',
      key: 'group-a'
    })
    const unchanged = groupManagerReducer(state, {
      kind: 'evaluation-result',
      token: 'old',
      key: 'group-a',
      evaluation: null
    })
    expect(unchanged).toBe(state)
  })

  it('replaces clean external drafts and marks dirty drafts as conflicts', () => {
    const initial = persistedGroup(1, 'Vorher')
    let clean = createGroupManagerState({
      activeKey: initial.id,
      initialGroup: initial,
      prospectiveGroupId: 'prospective',
      locationId: null
    })
    clean = groupManagerReducer(clean, {
      kind: 'sync-external',
      groups: [persistedGroup(2, 'Extern')]
    })
    expect(activeGroupSession(clean)?.group.name).toBe('Extern')
    expect(activeGroupSession(clean)?.externalConflict).toBe(false)

    let dirty = createGroupManagerState({
      activeKey: initial.id,
      initialGroup: initial,
      prospectiveGroupId: 'prospective',
      locationId: null
    })
    dirty = groupManagerReducer(dirty, {
      kind: 'mutate-group',
      mutation: { kind: 'name', update: 'Lokal' }
    })
    dirty = groupManagerReducer(dirty, {
      kind: 'sync-external',
      groups: [persistedGroup(2, 'Extern')]
    })
    expect(activeGroupSession(dirty)?.group.name).toBe('Lokal')
    expect(activeGroupSession(dirty)?.externalConflict).toBe(true)
  })

  it('uses one explicit confirmation policy for every transition class', () => {
    const dirty = { anyDraft: true, currentLoot: false }
    expect(groupManagerIntentNeedsConfirmation('all-drafts', dirty)).toBe(true)
    expect(groupManagerIntentNeedsConfirmation('current-loot', dirty)).toBe(
      false
    )
    expect(
      groupManagerIntentNeedsConfirmation('current-loot', {
        anyDraft: false,
        currentLoot: true
      })
    ).toBe(true)
    const currentLoot: GroupManagerIntent[] = [
      { kind: 'add-creature', creature: {} as never },
      {
        kind: 'change-quantity',
        creatureId: 'wolf',
        delta: 1,
        quantityKind: 'alive'
      },
      { kind: 'remove-creature', creatureId: 'wolf' },
      { kind: 'roster-history', direction: 'undo-roster' },
      { kind: 'generate-roster', mode: 'fill' },
      { kind: 'regenerate-loot', mode: 'reroll' }
    ]
    for (const intent of currentLoot)
      expect(groupManagerIntentGuard(intent)).toBe('current-loot')
    for (const kind of ['close', 'save', 'archive', 'join-combat'] as const)
      expect(groupManagerIntentGuard({ kind })).toBe('all-drafts')
  })

  it('maps platform keyboard history shortcuts outside editable controls', () => {
    expect(
      groupManagerHistoryShortcut({
        key: 'z',
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        editable: false
      })
    ).toBe('undo')
    expect(
      groupManagerHistoryShortcut({
        key: 'Z',
        ctrlKey: false,
        metaKey: true,
        shiftKey: true,
        editable: false
      })
    ).toBe('redo')
    expect(
      groupManagerHistoryShortcut({
        key: 'z',
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        editable: true
      })
    ).toBeNull()
  })
})

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

function persistedGroup(revision: number, name: string): SceneGroup {
  return {
    id: 'group-a',
    revision,
    name,
    note: '',
    disposition: 'hostile',
    archived: false,
    baseXp: 0,
    position: 0,
    entries: []
  }
}
