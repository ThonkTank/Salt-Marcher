import type { PartyCharacter } from '../../shared/contracts/party.js'
import {
  levelFloor,
  levelForXp,
  levelXp,
  type PartyLevelProgression
} from './party-roster-domain.js'

export function mapPartyCharacterRow(
  row: unknown,
  languages: readonly string[],
  progression: PartyLevelProgression = levelXp
): PartyCharacter {
  const value = row as Record<string, unknown>
  const xp = Number(value['xp'])
  const level = levelForXp(xp, progression)
  return {
    id: String(value['id']),
    name: String(value['name']),
    playerName:
      typeof value['player_name'] === 'string' ? value['player_name'] : null,
    species: typeof value['species'] === 'string' ? value['species'] : null,
    characterClass:
      typeof value['character_class'] === 'string'
        ? value['character_class']
        : null,
    languages: [...languages],
    level,
    passivePerception:
      value['passive_perception'] === null
        ? null
        : Number(value['passive_perception']),
    passiveInvestigation:
      value['passive_investigation'] === null
        ? null
        : Number(value['passive_investigation']),
    passiveInsight:
      value['passive_insight'] === null
        ? null
        : Number(value['passive_insight']),
    armorClass:
      value['armor_class'] === null ? null : Number(value['armor_class']),
    movementSpeedFeet:
      value['movement_speed_feet'] === null
        ? null
        : Number(value['movement_speed_feet']),
    travelPosition:
      value['travel_state'] === 'hex-positioned' &&
      typeof value['travel_map_id'] === 'string' &&
      typeof value['travel_q'] === 'number' &&
      typeof value['travel_r'] === 'number'
        ? {
            kind: 'hex',
            mapId: value['travel_map_id'],
            q: value['travel_q'],
            r: value['travel_r']
          }
        : null,
    attachedToPartyToken: value['travel_state'] !== 'detached',
    active: Number(value['active']) === 1,
    xp,
    currentLevelFloor: levelFloor(level, progression),
    nextLevelXp: level === 20 ? null : progression[level]!,
    xpSinceShortRest: Number(value['xp_since_short_rest']),
    xpSinceLongRest: Number(value['xp_since_long_rest'])
  }
}
