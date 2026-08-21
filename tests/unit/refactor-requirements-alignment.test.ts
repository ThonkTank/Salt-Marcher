import { readFileSync } from 'node:fs'
import { expect } from 'vitest'
import { legitimateLiteralGate } from '../architecture/support/architecture-gate.js'

const requirement = (area: string, name: string): string =>
  readFileSync(`docs/${area}/requirements/${name}.md`, 'utf8')

legitimateLiteralGate({
  name: 'assigns full-day and group-only generation to one owner each',
  path: 'docs/sessiongeneration/requirements/requirements-session-generation.md',
  owner: 'session-generation-and-loot-requirements',
  rationale:
    'Cross-document product ownership is expressed as canonical requirement prose, not a TypeScript contract.',
  inspect: (generation) => {
    const loot = requirement('loot', 'requirements-loot')
    expect(generation).toContain(
      'Session Planner is the sole full-day UI consumer'
    )
    expect(generation).toContain('separate loot-only proposal')
    expect(loot).toMatch(/exactly one immutable group-reward\s+run/)
    expect(loot).toMatch(/does not generate a\s+whole adventuring day/)
  }
})

legitimateLiteralGate({
  name: 'uses the same revisioned base and adjusted policy for Resolution and Loot',
  path: 'docs/loot/requirements/requirements-loot.md',
  owner: 'encounter-loot-session-requirements',
  rationale:
    'The shared revision policy is canonical requirement language spanning three product documents.',
  inspect: (loot) => {
    const encounter = requirement('encounter', 'requirements-encounter')
    const session = requirement('session', 'requirements-live-session')
    for (const content of [loot, encounter, session]) {
      expect(content.toLowerCase()).toContain('base')
      expect(content.toLowerCase()).toContain('adjusted')
      expect(content.toLowerCase()).toContain('campaign')
    }
    expect(loot).toMatch(/same\s+current\s+rule\s+and\s+revision/)
  }
})

legitimateLiteralGate({
  name: 'documents the one durable public preparation workflow',
  path: 'docs/sessionplanner/requirements/requirements-session-planner.md',
  owner: 'session-planner-requirements',
  rationale:
    'The public workflow and status vocabulary are durable product requirement literals.',
  inspect: (planner) => {
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
  }
})

legitimateLiteralGate({
  name: 'defines measured adaptive Session layout and non-persisting fit',
  path: 'docs/session/requirements/requirements-live-session.md',
  owner: 'live-session-requirements',
  rationale:
    'Measured layout thresholds and pseudolocalization behavior are canonical UI requirement literals.',
  inspect: (session) => {
    for (const term of [
      '`preferred`',
      '`available`',
      '`effective`',
      'native frame',
      'Electron rail',
      '200% scale',
      'Pseudolocalized copy',
      'Temporary shrink',
      'never writes either preferred width'
    ])
      expect(session).toContain(term)
    expect(session).toContain('native minimum is 720 px')
    expect(session).not.toContain('at least 1024 px wide')
  }
})
