import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const requirement = (area: string, name: string): string =>
  readFileSync(`docs/${area}/requirements/${name}.md`, 'utf8')

describe('Session Planner, Generation, Encounter, and Loot requirements', () => {
  it('assigns full-day and group-only generation to one owner each', () => {
    const generation = requirement(
      'sessiongeneration',
      'requirements-session-generation'
    )
    const loot = requirement('loot', 'requirements-loot')
    expect(generation).toContain(
      'Session Planner is the sole full-day UI consumer'
    )
    expect(generation).toContain('separate loot-only proposal')
    expect(loot).toMatch(/exactly one immutable group-reward\s+run/)
    expect(loot).toMatch(/does not generate a\s+whole adventuring day/)
  })

  it('uses the same revisioned base/adjusted policy for Resolution and Loot', () => {
    const loot = requirement('loot', 'requirements-loot')
    const encounter = requirement('encounter', 'requirements-encounter')
    const session = requirement('session', 'requirements-live-session')
    for (const content of [loot, encounter, session]) {
      expect(content).toMatch(/base/i)
      expect(content).toMatch(/adjusted/i)
      expect(content).toMatch(/campaign/i)
    }
    expect(loot).toMatch(/same\s+current\s+rule\s+and\s+revision/)
  })

  it('documents the one durable public preparation workflow', () => {
    const planner = requirement(
      'sessionplanner',
      'requirements-session-planner'
    )
    for (const operation of [
      'startPreparation',
      'preparationReceipt',
      'cancelPreparation'
    ])
      expect(planner).toContain(operation)
    for (const status of [
      'queued',
      'generating',
      'resolving_encounters',
      'saving',
      'succeeded',
      'invalid',
      'stale',
      'failed',
      'canceled'
    ])
      expect(planner).toContain(status)
  })
})
