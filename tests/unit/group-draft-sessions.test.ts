import { describe, expect, it } from 'vitest'
import {
  createGroupDraftSessions,
  groupDraftSessionsDirty,
  groupDraftSessionsReducer,
  groupDraftStateFromGroup
} from '../../src/renderer/features/session/group-draft-sessions.js'
import { groupManagerIntentNeedsConfirmation } from '../../src/renderer/features/session/group-manager-intent.js'

describe('group draft sessions', () => {
  it('owns the active draft and restores cached drafts immutably', () => {
    const empty = groupDraftStateFromGroup(null)
    let state = createGroupDraftSessions('group-a', empty)
    state = groupDraftSessionsReducer(state, {
      kind: 'mutate',
      mutation: { kind: 'name', update: 'A' }
    })
    state = groupDraftSessionsReducer(state, {
      kind: 'activate',
      key: 'group-b',
      fallback: empty
    })
    expect(state.cached['group-a']?.name).toBe('A')
    state = groupDraftSessionsReducer(state, {
      kind: 'mutate',
      mutation: { kind: 'name', update: 'B' }
    })
    state = groupDraftSessionsReducer(state, {
      kind: 'activate',
      key: 'group-a',
      fallback: empty
    })
    expect(state.draft.name).toBe('A')
    expect(state.cached['group-a']).toBeUndefined()
    expect(state.cached['group-b']?.name).toBe('B')
    expect(groupDraftSessionsDirty(state)).toBe(true)
  })

  it('applies one explicit confirmation policy to every transition class', () => {
    const dirty = { anyGroup: true, currentLoot: false, anyLoot: true }
    expect(groupManagerIntentNeedsConfirmation('close', dirty)).toBe(true)
    expect(groupManagerIntentNeedsConfirmation('all-loot', dirty)).toBe(true)
    expect(groupManagerIntentNeedsConfirmation('current-loot', dirty)).toBe(
      false
    )
  })
})
