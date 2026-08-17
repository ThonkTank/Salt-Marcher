import { describe, expect, it, vi } from 'vitest'
import {
  ReferenceChangeCoordinator,
  ReferenceDependencyIndex,
  type NpcReferenceDependencies
} from '../../src/core/reference/reference-change-coordinator.js'
import type { ReferenceIndex } from '../../src/shared/contracts/reference.js'

describe('Reference dependency invalidation', () => {
  it('replaces reverse dependencies without leaving stale edges', () => {
    const index = new ReferenceDependencyIndex()
    index.replace(dependency('npc-1', 'creature-1', 'faction-1', 'location-1'))
    index.replace(dependency('npc-1', 'creature-2', null, 'location-2'))

    expect(index.dependents('creature', 'creature-1')).toEqual([])
    expect(index.dependents('faction', 'faction-1')).toEqual([])
    expect(index.dependents('creature', 'creature-2')).toEqual(['npc-1'])
    expect(index.dependents('location', 'location-2')).toEqual(['npc-1'])
  })

  it('invalidates one changed NPC without reading every dependent document', () => {
    const rows = Array.from({ length: 5_000 }, (_, index) =>
      dependency(
        `npc-${index}`,
        `creature-${index % 100}`,
        `faction-${index % 20}`,
        `location-${index % 50}`
      )
    )
    const byId = new Map(rows.map((row) => [row.npcId, row]))
    const one = vi.fn((id: string) => byId.get(id) ?? null)
    const notices: unknown[] = []
    const coordinator = new ReferenceChangeCoordinator(
      () => 'campaign-1',
      campaignIndex,
      { all: () => rows, one },
      (notice) => notices.push(notice)
    )

    coordinator.record([{ kind: 'npc', id: 'npc-4321' }])

    expect(one).toHaveBeenCalledTimes(1)
    expect(notices).toEqual([
      {
        campaignId: 'campaign-1',
        revision: 'revision-1',
        changedTargets: [
          {
            scope: 'campaign',
            campaignId: 'campaign-1',
            entityKind: 'npc',
            entityId: 'npc-4321'
          }
        ]
      }
    ])
  })

  it('invalidates only NPC documents that depend on a renamed faction', () => {
    const rows = [
      dependency('npc-1', 'creature-1', 'faction-1', null),
      dependency('npc-2', 'creature-2', 'faction-2', null),
      dependency('npc-3', 'creature-3', 'faction-1', null)
    ]
    const byId = new Map(rows.map((row) => [row.npcId, row]))
    let changedTargets: readonly unknown[] = []
    const coordinator = new ReferenceChangeCoordinator(
      () => 'campaign-1',
      campaignIndex,
      { all: () => rows, one: (id) => byId.get(id) ?? null },
      (notice) => {
        changedTargets = notice.changedTargets
      }
    )

    coordinator.record([{ kind: 'faction', id: 'faction-1' }])

    expect(changedTargets).toEqual([
      {
        scope: 'campaign',
        campaignId: 'campaign-1',
        entityKind: 'faction',
        entityId: 'faction-1'
      },
      {
        scope: 'campaign',
        campaignId: 'campaign-1',
        entityKind: 'npc',
        entityId: 'npc-1'
      },
      {
        scope: 'campaign',
        campaignId: 'campaign-1',
        entityKind: 'npc',
        entityId: 'npc-3'
      }
    ])
  })
})

function dependency(
  npcId: string,
  creatureId: string,
  factionId: string | null,
  locationId: string | null
): NpcReferenceDependencies {
  return { npcId, creatureId, factionId, locationId }
}

function campaignIndex(campaignId: string): ReferenceIndex {
  return {
    scope: 'campaign',
    revision: 'revision-1',
    terms: [],
    campaignId
  } as ReferenceIndex
}
