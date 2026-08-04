import { describe, expect, it } from 'vitest'
import type { ReferenceDocument } from '../../src/shared/contracts/reference.js'
import {
  reduceDetailHistory,
  type DetailHistoryState
} from '../../src/renderer/features/session/use-session-detail-history.js'
import { travelSegmentProgress } from '../../src/renderer/features/hex/use-travel-clock.js'
import {
  emptyGroupDraftHistory,
  groupDraftReducer,
  type GroupDraftState
} from '../../src/renderer/features/session/group-draft.js'

const document = (id: string): ReferenceDocument => ({
  documentKind: 'article',
  target: {
    scope: 'srd',
    catalogId: 'srd-5.1',
    definitionKind: 'rule',
    definitionId: id
  },
  title: id,
  facts: [],
  blocks: [],
  source: null
})

const entry = (id: string, breadcrumb: string) => {
  const next = document(id)
  return { target: next.target, breadcrumb }
}

describe('renderer feature state', () => {
  it('keeps independent branch-aware detail histories per scene', () => {
    let state: DetailHistoryState = {}
    state = reduceDetailHistory(state, {
      type: 'open',
      sceneId: 'scene-a',
      entry: entry('wolf', 'Rudel › Wolf')
    })
    state = reduceDetailHistory(state, {
      type: 'open',
      sceneId: 'scene-a',
      entry: entry('bear', 'Wald › Bär')
    })
    state = reduceDetailHistory(state, {
      type: 'move',
      sceneId: 'scene-a',
      offset: -1
    })
    state = reduceDetailHistory(state, {
      type: 'open',
      sceneId: 'scene-a',
      entry: entry('crab', 'Küste › Krabbe')
    })

    expect(
      state['scene-a']?.entries.map(({ target }) =>
        target.scope === 'srd' ? target.definitionId : ''
      )
    ).toEqual(['wolf', 'crab'])
    expect(state['scene-a']?.index).toBe(1)
    expect(state['scene-b']).toBeUndefined()
  })

  it('bounds each scene detail history to one hundred target-only entries', () => {
    let state: DetailHistoryState = {}
    for (let index = 0; index < 125; index += 1)
      state = reduceDetailHistory(state, {
        type: 'open',
        sceneId: 'scene-a',
        entry: entry(`creature-${index}`, `Entry ${index}`)
      })
    expect(state['scene-a']?.entries).toHaveLength(100)
    expect(state['scene-a']?.entries[0]?.target).toMatchObject({
      definitionId: 'creature-25'
    })
    expect(state['scene-a']?.index).toBe(99)
  })

  it('clamps local travel interpolation without changing domain state', () => {
    expect(travelSegmentProgress(1_000, 2_000, 500)).toBe(0)
    expect(travelSegmentProgress(1_000, 2_000, 1_500)).toBe(0.5)
    expect(travelSegmentProgress(1_000, 2_000, 3_000)).toBe(1)
    expect(travelSegmentProgress(2_000, 2_000, 2_000)).toBe(1)
  })

  it('updates the group draft atomically without mutating cached drafts', () => {
    const initial: GroupDraftState = {
      name: 'Wölfe',
      note: '',
      disposition: 'hostile',
      quantities: { wolf: 2 },
      deadQuantities: {},
      facts: {},
      baseline: 'baseline',
      evaluation: null,
      seed: 0,
      message: '',
      generationSummary: '',
      history: emptyGroupDraftHistory()
    }
    const renamed = groupDraftReducer(initial, {
      kind: 'name',
      update: 'Grauwölfe'
    })
    const resized = groupDraftReducer(renamed, {
      kind: 'quantities',
      update: (current) => ({ ...current, wolf: 3 })
    })

    expect(initial).toMatchObject({ name: 'Wölfe', quantities: { wolf: 2 } })
    expect(resized).toMatchObject({
      name: 'Grauwölfe',
      quantities: { wolf: 3 }
    })
  })

  it('keeps twenty undoable group roster steps and truncates redo branches', () => {
    let state: GroupDraftState = {
      name: 'Wölfe',
      note: 'Bleibt unverändert',
      disposition: 'hostile',
      quantities: {},
      deadQuantities: {},
      facts: {},
      baseline: 'baseline',
      evaluation: null,
      seed: 0,
      message: '',
      generationSummary: '',
      history: emptyGroupDraftHistory()
    }
    for (let quantity = 1; quantity <= 25; quantity += 1)
      state = groupDraftReducer(state, {
        kind: 'roster',
        update: { quantities: { wolf: quantity }, deadQuantities: {} }
      })

    expect(state.history.past).toHaveLength(20)
    state = groupDraftReducer(state, { kind: 'undo-roster' })
    expect(state.quantities).toEqual({ wolf: 24 })
    expect(state.history.future).toHaveLength(1)

    state = groupDraftReducer(state, {
      kind: 'roster',
      update: { quantities: { wolf: 24 }, deadQuantities: { wolf: 1 } }
    })
    expect(state.history.future).toHaveLength(0)
    expect(state).toMatchObject({
      name: 'Wölfe',
      note: 'Bleibt unverändert',
      deadQuantities: { wolf: 1 }
    })
  })

  it('undoes and redoes living and dead quantities without touching identity', () => {
    const initial: GroupDraftState = {
      name: 'Wölfe',
      note: 'Am Tor',
      disposition: 'neutral',
      quantities: { wolf: 2 },
      deadQuantities: {},
      facts: {},
      baseline: 'baseline',
      evaluation: null,
      seed: 0,
      message: '',
      generationSummary: '',
      history: emptyGroupDraftHistory()
    }
    const changed = groupDraftReducer(initial, {
      kind: 'roster',
      update: { quantities: { wolf: 1 }, deadQuantities: { wolf: 1 } }
    })
    const undone = groupDraftReducer(changed, { kind: 'undo-roster' })
    const redone = groupDraftReducer(undone, { kind: 'redo-roster' })

    expect(undone).toMatchObject({
      name: 'Wölfe',
      note: 'Am Tor',
      disposition: 'neutral',
      quantities: { wolf: 2 },
      deadQuantities: {}
    })
    expect(redone).toMatchObject({
      quantities: { wolf: 1 },
      deadQuantities: { wolf: 1 }
    })
  })
})
