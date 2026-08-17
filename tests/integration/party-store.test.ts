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
