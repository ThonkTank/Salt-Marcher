import type { PartyCharacter } from '../../../shared/contracts/party.js'

export function partyCharacterMatchesSearch(
  member: PartyCharacter,
  search: string
): boolean {
  return `${member.name} ${member.playerName ?? ''} ${member.species ?? ''} ${member.characterClass ?? ''} ${member.languages.join(' ')} ${member.passivePerception ?? ''} ${member.passiveInvestigation ?? ''} ${member.passiveInsight ?? ''} ${member.id}`
    .toLocaleLowerCase()
    .includes(search.toLocaleLowerCase())
}
