import { readFileSync } from 'node:fs'
import Database from 'better-sqlite3'
import { describe, expect, it, vi } from 'vitest'
import {
  CampaignSchemaBootstrapper,
  createDefaultCampaignSchemaBootstrapper
} from '../../src/core/persistence/sqlite/campaign-schema-bootstrapper.js'

describe('CampaignSchemaBootstrapper', () => {
  it('orders capability registrations deterministically', () => {
    const calls: string[] = []
    const bootstrapper = new CampaignSchemaBootstrapper([
      registration('second', calls, ['first']),
      registration('first', calls),
      registration('independent', calls)
    ])
    const database = new Database(':memory:')
    bootstrapper.initialize(database)
    expect(calls).toEqual(['first', 'independent', 'second'])
    database.close()
  })

  it.each([
    [
      'duplicate',
      [registration('same'), registration('same')],
      'Duplicate campaign schema registration'
    ],
    [
      'missing',
      [registration('one', undefined, ['absent'])],
      'Missing campaign schema registration'
    ],
    [
      'cycle',
      [
        registration('one', undefined, ['two']),
        registration('two', undefined, ['one'])
      ],
      'Cyclic campaign schema registrations'
    ]
  ] as const)(
    'rejects %s registrations before database access',
    (_name, values, message) => {
      expect(() => new CampaignSchemaBootstrapper(values)).toThrow(message)
    }
  )

  it('keeps aggregate schema imports out of CampaignStore', () => {
    const store = readFileSync(
      'src/core/persistence/sqlite/campaign-store.ts',
      'utf8'
    )
    for (const aggregate of [
      'party-store',
      'scene-store',
      'live-combat',
      'location-store',
      'generated-run-store',
      'loot-schema',
      'npc-store'
    ])
      expect(store).not.toContain(aggregate)
    expect(createDefaultCampaignSchemaBootstrapper().names()).toContain(
      'schema-version'
    )
  })
})

function registration(
  name: string,
  calls?: string[],
  after: readonly string[] = []
) {
  return {
    name,
    after,
    initialize: vi.fn(() => calls?.push(name))
  }
}
