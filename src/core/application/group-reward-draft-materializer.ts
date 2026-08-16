import type { GroupRewardTreasureDraft } from '../../shared/contracts/loot.js'
import type { GeneratedTreasure } from '../../shared/contracts/session-generation.js'
import {
  materializeGroupRewardTreasureDraft,
  type MaterializedGroupRewardTreasureDraft
} from '../loot/group-reward-treasure-draft.js'
export class GroupRewardDraftMaterializer {
  materialize(
    generated: GeneratedTreasure,
    draft: GroupRewardTreasureDraft
  ): MaterializedGroupRewardTreasureDraft {
    return materializeGroupRewardTreasureDraft(generated, draft)
  }
}
