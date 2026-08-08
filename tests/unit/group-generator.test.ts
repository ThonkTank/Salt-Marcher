import { describe, expect, it } from 'vitest'
import { generateSceneGroupDraft } from '../../src/core/scene/group-generator.js'
import type { CreatureCatalogQuery } from '../../src/shared/contracts/encounter.js'
import type { EncounterTuning } from '../../src/shared/contracts/encounter-tuning.js'
import type { PartyMember } from '../../src/shared/contracts/live-session.js'
import type {
  RunningScene,
  SceneGroupDraftEntry
} from '../../src/shared/contracts/scene.js'

const query: CreatureCatalogQuery = {
  name: '',
  sizes: [],
  types: [],
  subtypes: [],
  biomes: [],
  alignments: [],
  encounterTableIds: [],
  factionIds: [],
  locationId: null,
  sort: 'name',
  direction: 'asc',
  offset: 0,
  limit: 50
}

const tuning: EncounterTuning = {
  difficulty: 'auto',
  amount: 'auto',
  balance: 'auto',
  diversity: 'auto'
}

const scene = {
  id: '00000000-0000-0000-0000-000000000000',
  groups: [],
  title: 'Generator test',
  locationId: null,
  locationName: ''
} as unknown as RunningScene

const party = [
  { level: 3, active: true },
  { level: 3, active: true },
  { level: 3, active: true },
  { level: 3, active: true }
] as unknown as PartyMember[]

function generate(
  seed: number,
  entries: readonly SceneGroupDraftEntry[] = [],
  mode: 'fill' | 'replace' = 'replace'
) {
  return generateSceneGroupDraft(
    scene,
    party,
    entries,
    mode,
    query,
    tuning,
    seed,
    0
  )
}

function signature(result: ReturnType<typeof generate>): string {
  return result.entries
    .map((entry) => `${entry.creatureId}:${entry.quantity}`)
    .join('|')
}

describe('scene group generator variation', () => {
  it('keeps the same seed deterministic', () => {
    expect(generate(0x12345678)).toEqual(generate(0x12345678))
  })

  it('spreads consecutive seeds across multiple candidates', () => {
    const signatures = new Set(
      [1, 2, 3, 4, 5].map((seed) => signature(generate(seed)))
    )
    expect(signatures.size).toBeGreaterThan(1)
  })

  it('keeps fill idempotent after the requested band is reached', () => {
    const first = generate(1)
    const entries = first.entries.map(({ creatureId, quantity }) => ({
      creatureId,
      quantity
    }))
    const filled = generate(2, entries, 'fill')
    expect(
      filled.entries.map(({ creatureId, quantity }) => ({
        creatureId,
        quantity
      }))
    ).toEqual(entries)
    expect(filled.quality).toBe('exact')
  })
})
