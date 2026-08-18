import type { CampaignImportSection } from '../../shared/contracts/campaign-import.js'
import type { CampaignImportSectionAdapter } from './campaign-import-section-adapter.js'

/**
 * Validates and orders capability-owned import adapters once at composition.
 * Runtime orchestration therefore has no section switch or parallel section
 * list to keep in sync.
 */
export class CampaignImportAdapterRegistry {
  private readonly orderedAdapters: readonly CampaignImportSectionAdapter<unknown>[]

  constructor(adapters: readonly CampaignImportSectionAdapter<unknown>[]) {
    const bySection = new Map<
      CampaignImportSection,
      CampaignImportSectionAdapter<unknown>
    >()
    for (const adapter of adapters) {
      if (bySection.has(adapter.section))
        throw new Error(`Duplicate campaign import adapter: ${adapter.section}`)
      bySection.set(adapter.section, adapter)
    }
    for (const adapter of adapters)
      for (const dependency of adapter.dependencies)
        if (!bySection.has(dependency))
          throw new Error(
            `Campaign import adapter ${adapter.section} has missing dependency ${dependency}`
          )

    const ordered: CampaignImportSectionAdapter<unknown>[] = []
    const remaining = new Set(bySection.keys())
    while (remaining.size > 0) {
      const ready = [...remaining]
        .filter((section) =>
          bySection
            .get(section)!
            .dependencies.every((dependency) => !remaining.has(dependency))
        )
        .sort()
      if (ready.length === 0)
        throw new Error('Campaign import adapter dependency cycle')
      for (const section of ready) {
        ordered.push(bySection.get(section)!)
        remaining.delete(section)
      }
    }
    this.orderedAdapters = Object.freeze(ordered)
  }

  ordered(): readonly CampaignImportSectionAdapter<unknown>[] {
    return this.orderedAdapters
  }

  removalOrder(): readonly CampaignImportSectionAdapter<unknown>[] {
    return [...this.orderedAdapters].reverse()
  }
}
