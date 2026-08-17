export const levelXp = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000,
  120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000
] as const

export const dailyXp = [
  300, 600, 1200, 1700, 3500, 4000, 5000, 6000, 7500, 9000, 10500, 11500, 13500,
  15000, 18000, 20000, 25000, 27000, 30000, 40000
] as const

export type PartyRosterMember = Readonly<{
  active: boolean
  level: number | null
  xpSinceShortRest: number
  xpSinceLongRest: number
}>

export type AdventuringDaySummary = Readonly<{
  available: boolean
  partySize: number
  dailyBudget: number
  shortRestXp: number
  longRestXp: number
}>

export type AdventuringDayCalculation = Readonly<{
  dailyBudget: number
  totalXp: number
  completedDays: number
  dayProgress: number
  shortRests: number
  longRests: number
  timeline: readonly string[]
}>

export function levelFloor(level: number | null): number {
  return level === null ? 0 : levelXp[level - 1]!
}

export function initialXpForLevel(level: number | null): number {
  return levelFloor(level)
}

export function xpAfterLevelSelection(
  currentXp: number,
  level: number | null
): number {
  return level === null ? currentXp : Math.max(currentXp, levelFloor(level))
}

export function applyXpAdjustment(
  member: Readonly<{
    level: number | null
    xp: number
    shortXp: number
    longXp: number
  }>,
  delta: number
): Readonly<{ xp: number; shortXp: number; longXp: number }> {
  const xp = Math.max(levelFloor(member.level), member.xp + delta)
  const applied = xp - member.xp
  return {
    xp,
    shortXp: Math.max(0, member.shortXp + applied),
    longXp: Math.max(0, member.longXp + applied)
  }
}

export function applyRest(
  member: Readonly<{ shortXp: number; longXp: number }>,
  type: 'short' | 'long'
): Readonly<{ shortXp: number; longXp: number }> {
  return {
    shortXp: 0,
    longXp: type === 'long' ? 0 : member.longXp
  }
}

export function positionPartyAtHex(
  mapId: string,
  coordinate: Readonly<{ q: number; r: number }>
): Readonly<{
  mapId: string
  q: number
  r: number
  state: 'hex-positioned'
}> {
  return { mapId, q: coordinate.q, r: coordinate.r, state: 'hex-positioned' }
}

export function clearPartyHexPosition(): Readonly<{
  mapId: null
  q: null
  r: null
  state: 'attached-unpositioned'
}> {
  return {
    mapId: null,
    q: null,
    r: null,
    state: 'attached-unpositioned'
  }
}

export function adventuringDay(
  members: readonly PartyRosterMember[]
): AdventuringDaySummary {
  const active = members.filter((member) => member.active)
  const withLevel = active.filter(
    (member): member is PartyRosterMember & { level: number } =>
      member.level !== null
  )
  const available = active.length > 0 && withLevel.length === active.length
  return {
    available,
    partySize: active.length,
    dailyBudget: available
      ? withLevel.reduce((sum, member) => sum + dailyXp[member.level - 1]!, 0)
      : 0,
    shortRestXp: active.reduce(
      (sum, member) => sum + member.xpSinceShortRest,
      0
    ),
    longRestXp: active.reduce((sum, member) => sum + member.xpSinceLongRest, 0)
  }
}

export function calculateAdventuringDay(
  rows: readonly { level: number; count: number }[],
  totalXp = 0
): AdventuringDayCalculation {
  const budget = rows.reduce(
    (sum, row) => sum + dailyXp[row.level - 1]! * row.count,
    0
  )
  if (budget === 0)
    return {
      dailyBudget: 0,
      totalXp,
      completedDays: 0,
      dayProgress: 0,
      shortRests: 0,
      longRests: 0,
      timeline: []
    }
  const completedDays = Math.floor(totalXp / budget)
  const remainder = totalXp % budget
  const partialRests = Math.min(2, Math.floor(remainder / (budget / 3)))
  const timeline = Array.from(
    { length: completedDays },
    (_, index) =>
      `Tag ${index + 1}: ${budget.toLocaleString('de-DE')} XP · Long Rest`
  )
  if (remainder > 0)
    timeline.push(
      `Tag ${completedDays + 1}: ${remainder.toLocaleString('de-DE')} / ${budget.toLocaleString('de-DE')} XP`
    )
  return {
    dailyBudget: budget,
    totalXp,
    completedDays,
    dayProgress: remainder / budget,
    shortRests: completedDays * 2 + partialRests,
    longRests: completedDays,
    timeline
  }
}
