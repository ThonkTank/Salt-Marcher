import type {
  PartyCharacter,
  PartyCharacterDraft
} from '../../../shared/contracts/party.js'
export const characterFields = [
  { key: 'name', label: 'character.name', numeric: false },
  { key: 'playerName', label: 'character.playerName', numeric: false },
  { key: 'species', label: 'character.species', numeric: false },
  { key: 'characterClass', label: 'character.characterClass', numeric: false },
  { key: 'level', label: 'character.level', numeric: true },
  { key: 'armorClass', label: 'character.armorClass', numeric: true },
  {
    key: 'movementSpeedFeet',
    label: 'character.movementSpeedFeet',
    numeric: true
  },
  {
    key: 'passivePerception',
    label: 'character.passivePerception',
    numeric: true
  },
  { key: 'passiveInsight', label: 'character.passiveInsight', numeric: true },
  {
    key: 'passiveInvestigation',
    label: 'character.passiveInvestigation',
    numeric: true
  },
  { key: 'languages', label: 'character.languages', numeric: false }
] as const
export type CharacterFormValues = Record<
  (typeof characterFields)[number]['key'],
  string
>

export function characterFormValues(
  member: PartyCharacter | null
): CharacterFormValues {
  return Object.fromEntries(
    characterFields.map(({ key }) => [
      key,
      key === 'languages'
        ? (member?.languages.join(', ') ?? '')
        : String(member?.[key] ?? '')
    ])
  ) as CharacterFormValues
}

export function parseCharacterForm(values: CharacterFormValues) {
  const seen = new Set<string>()
  const languages = values.languages
    .split(',')
    .map((value) => value.trim())
    .filter((value) => {
      const key = value.toLocaleLowerCase('de-DE')
      if (!value || seen.has(key)) return false
      seen.add(key)
      return true
    })
  const data = Object.fromEntries(
    characterFields.map(({ key, numeric }) => [
      key,
      key === 'languages'
        ? languages
        : numeric
          ? values[key].trim()
            ? Number(values[key])
            : null
          : key === 'name'
            ? values[key].trim()
            : values[key].trim() || null
    ])
  ) as PartyCharacterDraft
  const issues: { path: string[] }[] = []
  for (const { key, numeric } of characterFields) {
    if (key === 'languages') {
      if (
        languages.length > 100 ||
        languages.some((value) => value.length > 100)
      )
        issues.push({ path: [key] })
    } else if (numeric) {
      const value = data[key] as number | null
      if (
        value !== null &&
        (!Number.isInteger(value) ||
          value < (key === 'level' ? 1 : 0) ||
          value >
            (key === 'level' ? 20 : key === 'movementSpeedFeet' ? 999 : 99))
      )
        issues.push({ path: [key] })
    } else {
      const value = data[key] as string | null
      if ((key === 'name' && !value) || (value?.length ?? 0) > 100)
        issues.push({ path: [key] })
    }
  }
  return issues.length
    ? { success: false as const, error: { issues } }
    : { success: true as const, data }
}

export function characterProfileKey(member: PartyCharacter): string {
  return JSON.stringify(characterFormValues(member))
}

export function characterShortId(
  member: PartyCharacter,
  members: readonly PartyCharacter[]
): string {
  for (let length = 6; length < member.id.length; length += 2) {
    const suffix = member.id.slice(-length)
    if (
      !members.some(
        (other) => other.id !== member.id && other.id.endsWith(suffix)
      )
    )
      return suffix
  }
  return member.id
}
