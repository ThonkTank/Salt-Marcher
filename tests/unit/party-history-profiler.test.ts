import Database from 'better-sqlite3'
import { expect, it } from 'vitest'
import { HistoryProfiler } from '../performance/party-history-profiler.js'

it('counts actual returned rows and executed calls across both databases without double-counting nested phases', () => {
  const campaign = new Database(':memory:')
  const installation = new Database(':memory:')
  const profiler = new HistoryProfiler()
  const original: unknown = Reflect.get(campaign, 'prepare')
  try {
    campaign.exec(
      'CREATE TABLE example (id INTEGER PRIMARY KEY); INSERT INTO example VALUES (1),(2),(3)'
    )
    installation.exec(
      'CREATE TABLE setting (value INTEGER); INSERT INTO setting VALUES (4)'
    )
    profiler.installDatabase(campaign, 'campaign')
    profiler.installDatabase(installation, 'installation')
    const result = profiler.measure(() => {
      profiler.within('capture', () => {
        expect(campaign.prepare('SELECT id FROM example').all()).toHaveLength(3)
        expect(
          campaign.prepare('SELECT id FROM example WHERE id = ?').get(99)
        ).toBeUndefined()
      })
      profiler.within('persist', () =>
        campaign
          .transaction(() => {
            campaign.prepare('INSERT INTO example VALUES (?)').run(4)
            profiler.within('capture', () => {
              expect(
                installation.prepare('SELECT value FROM setting').get()
              ).toEqual({ value: 4 })
            })
          })
          .immediate()
      )
    })
    expect(result.phases['capture']).toMatchObject({
      reads: 3,
      rows: 4,
      writes: 0
    })
    expect(result.phases['persist']).toMatchObject({
      reads: 0,
      rows: 0,
      writes: 1
    })
    expect(result.phases['transaction-boundary']!.ms).toBeGreaterThanOrEqual(0)
    const sum = Object.values(result.phases).reduce(
      (total, phase) => total + phase.ms,
      0
    )
    expect(sum).toBeLessThanOrEqual(result.totalMs)
    expect(
      [...profiler.sqlShapes].some((shape) => shape.startsWith('installation:'))
    ).toBe(true)
    profiler.close()
    expect(Reflect.get(campaign, 'prepare')).toBe(original)
    expect(
      campaign.prepare('SELECT count(*) AS count FROM example').get()
    ).toEqual({ count: 4 })
  } finally {
    profiler.close()
    campaign.close()
    installation.close()
  }
})

it('fails closed for an uncounted SQL path and restores native methods after failure', () => {
  const db = new Database(':memory:')
  const profiler = new HistoryProfiler()
  const original: unknown = Reflect.get(db, 'exec')
  try {
    profiler.installDatabase(db, 'campaign')
    expect(() =>
      profiler.measure(() => db.exec('CREATE TABLE unexpected (value INTEGER)'))
    ).toThrow('Uncounted exec')
    expect(() => profiler.measure(() => db.pragma('page_size'))).toThrow(
      'Uncounted pragma'
    )
    profiler.close()
    expect(Reflect.get(db, 'exec')).toBe(original)
    db.exec('CREATE TABLE expected (value INTEGER)')
  } finally {
    profiler.close()
    db.close()
  }
})
