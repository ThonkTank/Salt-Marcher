import { expect, it } from 'vitest'
import type { PartyCharacter } from '../../src/shared/contracts/party.js'
import {
  partyRestProgress,
  restProgress,
  xpProgress
} from '../../src/renderer/features/scene-desktop/party-progress.js'
const member = {
  level: 5,
  xp: 11200,
  currentLevelFloor: 6500,
  nextLevelXp: 14000,
  xpSinceShortRest: 0,
  xpSinceLongRest: 700,
  burden: {
    dailyBudget: 3500,
    longTrusted: true,
    shortTrusted: true,
    sectionsTrusted: true,
    completedShortRestSections: 1,
    sectionStartXp: 700
  }
} as PartyCharacter
it('uses remaining budgets without showing invented progress for unknown facts', () => {
  expect(restProgress(member)).toMatchObject({ fill: 0, sections: 2 })
  expect(restProgress({ ...member, xpSinceLongRest: 2100 })).toMatchObject({
    fill: 0.5,
    sections: 2
  })
  expect(restProgress({ ...member, xpSinceLongRest: 5000 })).toMatchObject({
    fill: 1,
    due: true
  })
  expect(
    restProgress({
      ...member,
      burden: { ...member.burden!, dailyBudget: null }
    }).fill
  ).toBeNull()
  expect(
    restProgress({
      ...member,
      burden: { ...member.burden!, longTrusted: false }
    }).fill
  ).toBeNull()
  expect(
    restProgress({
      ...member,
      burden: { ...member.burden!, sectionsTrusted: false }
    })
  ).toMatchObject({ fill: 0.2, sections: null })
})
it('averages individuals equally, excludes unknown phase histories and omits mixed markers', () => {
  const other = { ...member, xpSinceLongRest: 2100 }
  expect(partyRestProgress([member, other])).toMatchObject({
    fill: 0.25,
    sections: 2
  })
  expect(
    partyRestProgress([
      member,
      { ...other, burden: { ...other.burden!, completedShortRestSections: 2 } }
    ]).sections
  ).toBeNull()
  expect(
    partyRestProgress([
      member,
      { ...other, burden: { ...other.burden!, sectionsTrusted: false } }
    ])
  ).toMatchObject({
    fill: 0,
    text: 'Durchschnittlicher Rastbedarf · 1 von 2 Charakteren · Teilbasis'
  })
})
it('shows current XP and next threshold with explicit missing/highest-level states', () => {
  expect(xpProgress(member).fill).toBeCloseTo(4700 / 7500)
  expect(
    xpProgress({ ...member, level: null, nextLevelXp: null })
  ).toMatchObject({ fill: null })
  expect(
    xpProgress({ ...member, level: 20, nextLevelXp: null }).text
  ).toContain('Höchste Stufe')
})
