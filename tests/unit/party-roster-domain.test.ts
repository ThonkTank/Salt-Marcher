import { describe, expect, it } from 'vitest'
import {
  adventuringDay,
  applyRest,
  applyXpAdjustment,
  calculateAdventuringDay,
  clearPartyHexPosition,
  initialXpForLevel,
  positionPartyAtHex,
  xpAfterLevelSelection,
  levelFloor
} from '../../src/core/party/party-roster-domain.js'

describe('Party roster domain', () => {
  it('caps downward XP corrections at the current level floor', () => {
    expect(
      applyXpAdjustment(
        { level: 5, xp: 7_000, shortXp: 700, longXp: 1_200 },
        -2_000
      )
    ).toEqual({ xp: 6_500, shortXp: 200, longXp: 700 })
    expect(levelFloor(null)).toBe(0)
    expect(initialXpForLevel(5)).toBe(6_500)
    expect(xpAfterLevelSelection(7_000, 4)).toBe(7_000)
    expect(xpAfterLevelSelection(7_000, null)).toBe(7_000)
  })

  it('applies rest counters and travel positions as pure transitions', () => {
    expect(applyRest({ shortXp: 300, longXp: 500 }, 'short')).toEqual({
      shortXp: 0,
      longXp: 500
    })
    expect(applyRest({ shortXp: 300, longXp: 500 }, 'long')).toEqual({
      shortXp: 0,
      longXp: 0
    })
    expect(positionPartyAtHex('map-1', { q: 4, r: -2 })).toEqual({
      mapId: 'map-1',
      q: 4,
      r: -2,
      state: 'hex-positioned'
    })
    expect(clearPartyHexPosition()).toEqual({
      mapId: null,
      q: null,
      r: null,
      state: 'attached-unpositioned'
    })
  })

  it('derives the active party budget without persistence dependencies', () => {
    expect(
      adventuringDay([
        {
          active: true,
          level: 3,
          xpSinceShortRest: 100,
          xpSinceLongRest: 200
        },
        {
          active: true,
          level: 4,
          xpSinceShortRest: 300,
          xpSinceLongRest: 400
        },
        {
          active: false,
          level: null,
          xpSinceShortRest: 500,
          xpSinceLongRest: 600
        }
      ])
    ).toEqual({
      available: true,
      partySize: 2,
      dailyBudget: 2_900,
      shortRestXp: 400,
      longRestXp: 600
    })
  })

  it('calculates completed days and partial-rest milestones', () => {
    expect(calculateAdventuringDay([{ level: 3, count: 2 }], 3_000)).toEqual({
      dailyBudget: 2_400,
      totalXp: 3_000,
      completedDays: 1,
      dayProgress: 0.25,
      shortRests: 2,
      longRests: 1,
      timeline: ['Tag 1: 2.400 XP · Long Rest', 'Tag 2: 600 / 2.400 XP']
    })
  })
})
