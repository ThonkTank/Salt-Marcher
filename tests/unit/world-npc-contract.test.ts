import { describe, expect, it } from 'vitest'
import {
  createWorldNpcInputSchema,
  worldNpcDraftSchema,
  worldNpcSchema
} from '../../src/shared/contracts/world-npc.js'
import { partyCharacterDraftSchema } from '../../src/shared/contracts/party.js'

const draft = {
  displayName: 'Erika',
  creatureId: 'sprite',
  lifecycle: 'active' as const,
  appearance: '',
  behavior: '',
  history: '',
  notes: '',
  dispositionModifier: 0,
  factionId: null,
  locationId: null
}

describe('World NPC and structured PC contracts', () => {
  it('accepts only the strict bounded NPC shape', () => {
    expect(worldNpcDraftSchema.parse(draft)).toEqual(draft)
    expect(() =>
      worldNpcDraftSchema.parse({ ...draft, dispositionModifier: 51 })
    ).toThrow()
    expect(() => worldNpcDraftSchema.parse({ ...draft, extra: true })).toThrow()
    expect(() =>
      worldNpcSchema.parse({
        ...draft,
        id: '01900000-0000-7000-8000-000000000001',
        position: -1
      })
    ).toThrow()
  })

  it('requires both aggregate revisions on every NPC mutation', () => {
    const input = {
      commandId: '01900000-0000-7000-8000-000000000002',
      expectedRevision: 3,
      expectedFactionRevision: 7,
      npc: draft
    }
    expect(createWorldNpcInputSchema.parse(input)).toEqual(input)
    const incomplete = {
      commandId: input.commandId,
      expectedRevision: input.expectedRevision,
      npc: input.npc
    }
    expect(() => createWorldNpcInputSchema.parse(incomplete)).toThrow()
  })

  it('keeps optional PC profile facts bounded and languages canonical-unique', () => {
    const character = {
      name: 'Grikania',
      playerName: 'Jan',
      species: 'Githjanki',
      characterClass: 'Rogue',
      languages: ['Common', 'Gith'],
      level: 2,
      passivePerception: 16,
      passiveInvestigation: 16,
      passiveInsight: 12,
      armorClass: null,
      movementSpeedFeet: null
    }
    expect(partyCharacterDraftSchema.parse(character)).toEqual(character)
    expect(() =>
      partyCharacterDraftSchema.parse({
        ...character,
        languages: ['Common', ' common ']
      })
    ).toThrow('Languages must be unique')
    expect(() =>
      partyCharacterDraftSchema.parse({
        ...character,
        passiveInsight: 100
      })
    ).toThrow()
  })
})
