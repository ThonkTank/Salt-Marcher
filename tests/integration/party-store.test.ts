import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import {
  initializePartySchema,
  PartyStore
} from '../../src/core/party/party-store.js'

const databases: Database.Database[] = []

afterEach(() => {
  for (const database of databases.splice(0)) database.close()
})

describe('Party store', () => {
  it('initializes a production roster without example characters', () => {
    const database = openDatabase()
    initializePartySchema(database)

    expect(new PartyStore(database).read()).toMatchObject({
      revision: 0,
      members: []
    })
  })

  it('creates at level 1 and derives level changes from configured XP', () => {
    const database = openDatabase()
    initializePartySchema(database)
    const progression = Array.from({ length: 20 }, (_, index) => index * 100)
    const party = new PartyStore(database, progression)
    const created = party.create(
      {
        name: 'Aria',
        playerName: null,
        passivePerception: null,
        armorClass: null
      },
      0
    )
    const id = created.members[0]!.id

    expect(created.members[0]).toMatchObject({ xp: 0, level: 1 })
    const advanced = party.adjustXp(id, 250, created.revision)
    expect(advanced.members[0]).toMatchObject({ xp: 250, level: 3 })
    const corrected = party.adjustXp(id, -200, advanced.revision)
    expect(corrected.members[0]).toMatchObject({ xp: 50, level: 1 })
  })

  it('loads languages with a constant query count as the roster grows', () => {
    const statements: string[] = []
    const database = openDatabase((statement) => statements.push(statement))
    initializePartySchema(database)
    const party = new PartyStore(database)
    let revision = 0
    for (let position = 0; position < 64; position += 1) {
      revision = party.create(
        {
          name: `Character ${position}`,
          playerName: null,
          species: null,
          characterClass: null,
          languages: ['Common', `Language ${position}`],
          level: 1,
          passivePerception: null,
          passiveInvestigation: null,
          passiveInsight: null,
          armorClass: null,
          movementSpeedFeet: null
        },
        revision
      ).revision
    }

    statements.length = 0
    const snapshot = party.read()

    expect(snapshot.members).toHaveLength(64)
    expect(snapshot.members[63]?.languages).toEqual(['Common', 'Language 63'])
    expect(
      statements.filter((statement) => /^SELECT\b/i.test(statement.trim()))
    ).toHaveLength(3)
  })
})

function openDatabase(
  verbose?: (statement: string) => void
): Database.Database {
  const database = new Database(':memory:', {
    verbose:
      verbose === undefined
        ? undefined
        : (statement: unknown) => verbose(String(statement))
  })
  database.pragma('foreign_keys = ON')
  databases.push(database)
  return database
}
