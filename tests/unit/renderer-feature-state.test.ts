import { describe, expect, it } from 'vitest'
import type { ReferenceDocument } from '../../src/shared/contracts/reference.js'
import {
  reduceDetailHistory,
  type DetailHistoryState
} from '../../src/renderer/features/session/use-session-detail-history.js'
import { travelSegmentProgress } from '../../src/renderer/features/hex/use-travel-clock.js'
import {
  groupDraftReducer,
  type GroupDraftState
} from '../../src/renderer/features/session/group-draft.js'

const document = (id: string): ReferenceDocument => ({
  target: { kind: 'creature', id },
  title: id,
  context: 'Creature Statblock',
  summary: '',
  facts: [],
  sections: [],
  source: null,
  creature: { id } as ReferenceDocument['creature']
})

const entry = (id: string, breadcrumb: string) => {
  const next = document(id)
  return { target: next.target, document: next, breadcrumb }
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

    expect(state['scene-a']?.entries.map(({ target }) => target.id)).toEqual([
      'wolf',
      'crab'
    ])
    expect(state['scene-a']?.index).toBe(1)
    expect(state['scene-b']).toBeUndefined()
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
      message: ''
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
})
