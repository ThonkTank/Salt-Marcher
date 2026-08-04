import { describe, expect, it } from 'vitest'
import type { Creature } from '../../src/shared/contracts/encounter.js'
import {
  reduceDetailHistory,
  type DetailHistoryState
} from '../../src/renderer/features/session/use-session-detail-history.js'
import { travelSegmentProgress } from '../../src/renderer/features/hex/use-travel-clock.js'

const creature = (id: string) => ({ id }) as Creature

describe('renderer feature state', () => {
  it('keeps independent branch-aware detail histories per scene', () => {
    let state: DetailHistoryState = {}
    state = reduceDetailHistory(state, {
      type: 'open',
      sceneId: 'scene-a',
      entry: { creature: creature('wolf'), breadcrumb: 'Rudel › Wolf' }
    })
    state = reduceDetailHistory(state, {
      type: 'open',
      sceneId: 'scene-a',
      entry: { creature: creature('bear'), breadcrumb: 'Wald › Bär' }
    })
    state = reduceDetailHistory(state, {
      type: 'move',
      sceneId: 'scene-a',
      offset: -1
    })
    state = reduceDetailHistory(state, {
      type: 'open',
      sceneId: 'scene-a',
      entry: { creature: creature('crab'), breadcrumb: 'Küste › Krabbe' }
    })

    expect(
      state['scene-a']?.entries.map(({ creature }) => creature.id)
    ).toEqual(['wolf', 'crab'])
    expect(state['scene-a']?.index).toBe(1)
    expect(state['scene-b']).toBeUndefined()
  })

  it('clamps local travel interpolation without changing domain state', () => {
    expect(travelSegmentProgress(1_000, 2_000, 500)).toBe(0)
    expect(travelSegmentProgress(1_000, 2_000, 1_500)).toBe(0.5)
    expect(travelSegmentProgress(1_000, 2_000, 3_000)).toBe(1)
    expect(travelSegmentProgress(2_000, 2_000, 2_000)).toBe(1)
  })
})
