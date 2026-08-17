import type Database from 'better-sqlite3'
import { PartyStore } from './party-store.js'
import type { PartySnapshot } from '../../shared/contracts/party.js'

const exampleNames = ['Alrik', 'Brynn', 'Cora', 'Dain'] as const

/** Explicit development/test fixture. Production schema initialization is empty. */
export function seedExampleParty(db: Database.Database): PartySnapshot {
  const party = new PartyStore(db)
  if (party.read().members.length > 0)
    throw new Error('Example party seed requires an empty roster')
  let revision = party.read().revision
  for (const name of exampleNames) {
    const snapshot = party.create(
      {
        name,
        playerName: null,
        species: null,
        characterClass: null,
        languages: [],
        level: 3,
        passivePerception: null,
        passiveInvestigation: null,
        passiveInsight: null,
        armorClass: null,
        movementSpeedFeet: null
      },
      revision
    )
    revision = snapshot.revision
  }
  return party.read()
}
