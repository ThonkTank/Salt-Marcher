import type { PartyCharacter } from '../../../shared/contracts/party.js'
import type { PartyQuickField } from '../../../shared/contracts/party-quick-fields.js'
export const partyFieldGroups: readonly {
  label: string
  fields: readonly PartyQuickField[]
}[] = [
  {
    label: 'Charakter',
    fields: ['characterClass', 'level', 'species', 'playerName']
  },
  { label: 'Kampf', fields: ['armorClass', 'movementSpeedFeet'] },
  {
    label: 'Passiv',
    fields: ['passivePerception', 'passiveInsight', 'passiveInvestigation']
  },
  { label: 'Sprachen', fields: ['languages'] }
]
export const partyFieldLabels: Record<PartyQuickField, string> = {
  characterClass: 'Class',
  level: 'Level',
  species: 'Species',
  playerName: 'Spieler',
  armorClass: 'AC',
  movementSpeedFeet: 'Speed',
  passivePerception: 'Per.',
  passiveInsight: 'Ins.',
  passiveInvestigation: 'Inv.',
  languages: 'Sprachen'
}
export function partyFieldValues(
  member: PartyCharacter,
  fields: readonly PartyQuickField[]
): string[] {
  return fields.flatMap((field) => {
    if (field === 'characterClass')
      return member.characterClass
        ? [
            fields.includes('level')
              ? `${member.characterClass} ${member.level ?? '—'}`
              : member.characterClass
          ]
        : ['Klasse —']
    if (field === 'level')
      return fields.includes('characterClass') && member.characterClass
        ? []
        : [`Level ${member.level ?? '—'}`]
    if (field === 'species' || field === 'playerName')
      return member[field]
        ? [member[field]]
        : [`${field === 'species' ? 'Spezies' : 'Spieler'} —`]
    if (field === 'languages')
      return member.languages.length
        ? [member.languages.join(', ')]
        : ['Sprachen —']
    if (field === 'movementSpeedFeet')
      return [`Speed ${member[field] == null ? '—' : `${member[field]} ft.`}`]
    return [`${partyFieldLabels[field]} ${member[field] ?? '—'}`]
  })
}
