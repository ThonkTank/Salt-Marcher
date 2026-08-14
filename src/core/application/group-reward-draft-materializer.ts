import type { GroupRewardTreasureDraft } from '../../shared/contracts/loot.js'
import type {
  GeneratedRun,
  GeneratedTreasure
} from '../../shared/contracts/session-generation.js'
import {
  materializeGroupRewardTreasureDraft,
  type MaterializedGroupRewardTreasureDraft
} from '../loot/group-reward-treasure-draft.js'
import type { LootCatalogIndex } from '../loot/loot-catalog-index.js'

export type GroupRewardDraftMaterializerContext = Readonly<{
  catalog: Readonly<{
    index(reference: {
      catalogVersion: string
      catalogContentHash: string
    }): LootCatalogIndex
  }>
}>

export class GroupRewardDraftMaterializer {
  constructor(private readonly context: GroupRewardDraftMaterializerContext) {}

  materialize(
    run: Extract<GeneratedRun, { runKind: 'group_reward' }>,
    generated: GeneratedTreasure,
    draft: GroupRewardTreasureDraft
  ): MaterializedGroupRewardTreasureDraft {
    const needsCatalog =
      draft.items.some((item) => item.origin.kind === 'catalog') ||
      draft.containers.some((container) => container.origin.kind === 'catalog')
    return materializeGroupRewardTreasureDraft(
      generated,
      draft,
      needsCatalog
        ? this.context.catalog.index({
            catalogVersion: run.catalogVersion,
            catalogContentHash: run.catalogContentHash
          })
        : null
    )
  }
}
