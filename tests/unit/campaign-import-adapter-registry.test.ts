import { describe, expect, it } from 'vitest'
import type { CampaignImportSection } from '../../src/shared/contracts/campaign-import.js'
import { CampaignImportAdapterRegistry } from '../../src/core/campaign-import/campaign-import-adapter-registry.js'
import type { CampaignImportSectionAdapter } from '../../src/core/campaign-import/campaign-import-section-adapter.js'

describe('CampaignImportAdapterRegistry', () => {
  it('orders adapters by declared dependencies without a central section switch', () => {
    const registry = new CampaignImportAdapterRegistry([
      adapter('npcs', ['locations', 'factions']),
      adapter('party'),
      adapter('factions'),
      adapter('locations')
    ])

    expect(registry.ordered().map(({ section }) => section)).toEqual([
      'factions',
      'locations',
      'party',
      'npcs'
    ])
    expect(registry.removalOrder().map(({ section }) => section)).toEqual([
      'npcs',
      'party',
      'locations',
      'factions'
    ])
  })

  it('fails closed for duplicate, missing, and cyclic registrations', () => {
    expect(
      () =>
        new CampaignImportAdapterRegistry([adapter('party'), adapter('party')])
    ).toThrow('Duplicate campaign import adapter: party')
    expect(
      () => new CampaignImportAdapterRegistry([adapter('npcs', ['factions'])])
    ).toThrow('Campaign import adapter npcs has missing dependency factions')
    expect(
      () =>
        new CampaignImportAdapterRegistry([
          adapter('factions', ['npcs']),
          adapter('npcs', ['factions'])
        ])
    ).toThrow('Campaign import adapter dependency cycle')
  })
})

function adapter(
  section: CampaignImportSection,
  dependencies: readonly CampaignImportSection[] = []
): CampaignImportSectionAdapter<unknown> {
  return {
    section,
    dependencies,
    select: () => [],
    validate: () => [],
    diff: () => ({
      section,
      values: [],
      removed: [],
      changedExternalKeys: []
    }),
    apply: () => [],
    readBack: () => ({
      name: section,
      expected: [],
      actual: [],
      passed: true
    }),
    summarize: () => 0
  }
}
