import { describe, expect, it } from 'vitest'
import { mapPartyCharacterRow } from '../../src/core/party/party-row-mapper.js'

describe('Party row mapper', () => {
  it('projects nullable persistence fields and explicit travel state', () => {
    expect(
      mapPartyCharacterRow(
        {
          id: 'character-1',
          name: 'Mara',
          player_name: null,
          species: 'Human',
          character_class: 'Ranger',
          level: 5,
          passive_perception: 16,
          passive_investigation: null,
          passive_insight: 14,
          armor_class: 17,
          movement_speed_feet: 30,
          travel_map_id: 'map-1',
          travel_q: 4,
          travel_r: -2,
          travel_state: 'hex-positioned',
          active: 1,
          xp: 7_000,
          xp_since_short_rest: 200,
          xp_since_long_rest: 700
        },
        ['Common', 'Elvish']
      )
    ).toMatchObject({
      id: 'character-1',
      playerName: null,
      languages: ['Common', 'Elvish'],
      currentLevelFloor: 6_500,
      nextLevelXp: 14_000,
      travelPosition: { kind: 'hex', mapId: 'map-1', q: 4, r: -2 },
      attachedToPartyToken: true
    })
  })
})
