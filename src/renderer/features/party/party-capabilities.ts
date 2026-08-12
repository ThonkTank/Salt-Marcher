import type { SaltMarcherApi } from '../../../shared/contracts/capability-api.js'
import type { PartyCharacterDraft } from '../../../shared/contracts/party.js'

/** Positional convenience is local to the Party renderer adapter. */
export function partyCapabilities(api: SaltMarcherApi) {
  return {
    party: {
      read: api.party.read,
      create: (character: PartyCharacterDraft, expectedRevision: number) =>
        api.party.create({
          character: {
            ...character,
            movementSpeedFeet: character.movementSpeedFeet ?? null
          },
          expectedRevision
        }),
      update: (
        id: string,
        character: PartyCharacterDraft,
        expectedRevision: number
      ) =>
        api.party.update({
          id,
          character: {
            ...character,
            movementSpeedFeet: character.movementSpeedFeet ?? null
          },
          expectedRevision
        }),
      delete: (id: string, expectedRevision: number) =>
        api.party.delete({ id, expectedRevision }),
      setMembership: (id: string, active: boolean, expectedRevision: number) =>
        api.party.setMembership({ id, active, expectedRevision }),
      adjustXp: (id: string, delta: number, expectedRevision: number) =>
        api.party.adjustXp({ id, delta, expectedRevision }),
      rest: (type: 'short' | 'long', expectedRevision: number) =>
        api.party.rest({ type, expectedRevision }),
      calculateAdventuringDay: (
        rows: readonly { level: number; count: number }[],
        totalXp?: number
      ) =>
        api.party.calculateAdventuringDay({
          rows: [...rows],
          ...(totalXp === undefined ? {} : { totalXp })
        })
    }
  }
}

export type PartyCapabilities = ReturnType<typeof partyCapabilities>
