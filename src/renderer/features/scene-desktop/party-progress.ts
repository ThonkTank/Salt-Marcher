import type { PartyCharacter } from '../../../shared/contracts/party.js'

export type RestProgress = Readonly<{
  fill: number | null
  sections: number | null
  due: boolean
  text: string
}>
const number = (value: number) => value.toLocaleString('de-DE')
export function restProgress(member: PartyCharacter): RestProgress {
  const burden = member.burden
  const used = member.xpSinceLongRest
  const budget = burden?.dailyBudget
  const known = burden?.sectionsTrusted && burden.longTrusted
  const start = burden?.sectionStartXp ?? 0
  const sections = known ? 3 - (burden.completedShortRestSections ?? 0) : null
  const due = !!burden?.longTrusted && budget != null && used >= budget
  const text = `${number(used)} / ${budget == null ? 'Budget unbekannt' : `${number(budget)} XP Tagesbudget`}${!burden?.longTrusted ? ' · Ausgangswert unbekannt' : ''}${!known ? ' · Abschnittshistorie unbekannt' : ''}${due ? ' · Lange Rast fällig' : ''}`
  return {
    fill:
      !burden?.longTrusted || budget == null
        ? null
        : due
          ? 1
          : Math.max(
              0,
              Math.min(
                1,
                known ? (used - start) / (budget - start) : used / budget
              )
            ),
    sections,
    due,
    text
  }
}
export function partyRestProgress(
  members: readonly PartyCharacter[]
): RestProgress {
  const values = members
    .map(restProgress)
    .filter((value) => value.fill !== null && value.sections !== null)
  const sections = values[0]?.sections ?? null
  return {
    fill: values.length
      ? values.reduce((sum, value) => sum + value.fill!, 0) / values.length
      : null,
    sections: values.every((value) => value.sections === sections)
      ? sections
      : null,
    due: values.length > 0 && values.every((value) => value.due),
    text: `Durchschnittlicher Rastbedarf · ${values.length} von ${members.length} Charakteren${values.length < members.length ? ' · Teilbasis' : ''}`
  }
}
export function xpProgress(member: PartyCharacter) {
  return {
    fill:
      member.level === null
        ? null
        : member.nextLevelXp === null
          ? 1
          : Math.max(
              0,
              Math.min(
                1,
                (member.xp - member.currentLevelFloor) /
                  (member.nextLevelXp - member.currentLevelFloor)
              )
            ),
    text: `${number(member.xp)} XP${member.level === null ? ' · Stufe fehlt' : member.nextLevelXp === null ? ' · Höchste Stufe' : ` · Nächste Stufe bei ${number(member.nextLevelXp)} XP`}`
  }
}
