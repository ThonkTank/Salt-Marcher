import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import {
  initializePartySchema,
  migratePartyBurden34To35,
  PartyStore
} from '../../src/core/party/party-store.js'
import { partyCharacterDraftSchema } from '../../src/shared/contracts/party.js'
const draft = partyCharacterDraftSchema.parse({
  name: 'Edrik',
  playerName: null,
  level: 3,
  passivePerception: null,
  armorClass: null
})
describe('XP burden provenance', () => {
  it('preserves legacy mixed counters as unknown and leaves them unchanged for all manual XP modes', () => {
    const db = new Database(':memory:')
    try {
      initializePartySchema(db)
      const store = new PartyStore(db)
      let party = store.create(draft, 0)
      const id = party.members[0]!.id
      db.exec(
        'ALTER TABLE player_characters DROP COLUMN short_rest_trusted; ALTER TABLE player_characters DROP COLUMN long_rest_trusted; UPDATE player_characters SET xp_since_short_rest = 123, xp_since_long_rest = 456'
      )
      migratePartyBurden34To35(db)
      party = store.read()
      expect(party.members[0]).toMatchObject({
        xpSinceShortRest: 123,
        xpSinceLongRest: 456,
        burden: { shortTrusted: false, longTrusted: false, dailyBudget: 1200 }
      })
      party = store.adjustXp(id, 100, party.revision)
      expect(party.members[0]!.xp).toBe(1000)
      party = store.setXp(id, 2000, party.revision)
      expect(party.members[0]!.xp).toBe(2000)
      party = store.adjustXp(id, -1_000_000, party.revision)
      expect(party.members[0]).toMatchObject({
        xp: 900,
        xpSinceShortRest: 123,
        xpSinceLongRest: 456
      })
      expect(() => store.setXp(id, -1, party.revision)).toThrow()
      expect(() => store.adjustXp(id, 0.5, party.revision)).toThrow()
      expect(() => store.setXp(id, 3000, party.revision - 1)).toThrow()
      expect(store.read()).toEqual(party)
    } finally {
      db.close()
    }
  })
  it('rests only selected active IDs and establishes short and long baselines independently', () => {
    const db = new Database(':memory:')
    try {
      initializePartySchema(db)
      const store = new PartyStore(db)
      let party = store.create(draft, 0)
      party = store.create({ ...draft, name: 'Vivian' }, party.revision)
      const [first, second] = party.members
      party = store.setMembership(first!.id, true, party.revision)
      party = store.setMembership(second!.id, true, party.revision)
      db.exec(
        'UPDATE player_characters SET xp_since_short_rest = 300, xp_since_long_rest = 700, short_rest_trusted = 0, long_rest_trusted = 0'
      )
      party = store.rest('short', party.revision, [first!.id])
      expect(party.members[0]).toMatchObject({
        xpSinceShortRest: 0,
        xpSinceLongRest: 700,
        burden: { shortTrusted: true, longTrusted: false }
      })
      expect(party.members[1]).toMatchObject({
        xpSinceShortRest: 300,
        xpSinceLongRest: 700,
        burden: { shortTrusted: false, longTrusted: false }
      })
      expect(() =>
        store.rest('long', party.revision, [first!.id, 'missing'])
      ).toThrow()
      expect(store.read()).toEqual(party)
      party = store.rest('long', party.revision, [first!.id])
      expect(party.members[0]).toMatchObject({
        xpSinceShortRest: 0,
        xpSinceLongRest: 0,
        burden: { shortTrusted: true, longTrusted: true }
      })
      expect(party.members[1]!.xpSinceLongRest).toBe(700)
    } finally {
      db.close()
    }
  })

  it('awards only actual recipients once and rolls invalid selections back completely', () => {
    const db = new Database(':memory:')
    try {
      initializePartySchema(db)
      const store = new PartyStore(db)
      let party = store.create(draft, 0)
      party = store.create({ ...draft, name: 'Vivian' }, party.revision)
      const [first, second] = party.members
      party = store.setMembership(first!.id, true, party.revision)
      party = store.setMembership(second!.id, true, party.revision)
      expect(() =>
        store.awardCombatXp('invalid', 100, [first!.id, 'missing'])
      ).toThrow()
      expect(store.read()).toEqual(party)
      party = store.awardCombatXp('encounter', 100, [first!.id])
      expect(party.members[0]).toMatchObject({
        xp: 1000,
        xpSinceShortRest: 100,
        xpSinceLongRest: 100,
        burden: { shortTrusted: true, longTrusted: true }
      })
      expect(party.members[1]).toMatchObject({
        xp: 900,
        xpSinceShortRest: 0,
        xpSinceLongRest: 0
      })
      expect(store.awardCombatXp('encounter', 100, [first!.id])).toEqual(party)
      expect(
        db
          .prepare('SELECT * FROM party_xp_awards WHERE combat_id = ?')
          .get('invalid')
      ).toBeUndefined()
    } finally {
      db.close()
    }
  })
})
