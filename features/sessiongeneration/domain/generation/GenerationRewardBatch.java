package features.sessiongeneration.domain.generation;

import java.util.List;

public record GenerationRewardBatch(List<ResolvedReward> resolved, List<GenerationRewardReference> missing) {

    public GenerationRewardBatch {
        resolved = List.copyOf(resolved);
        missing = List.copyOf(missing);
    }

    public record ResolvedReward(
            GenerationRewardReference reference,
            GeneratedRun.TreasurePlan treasure,
            List<GeneratedRun.LootLine> loot,
            List<GeneratedRun.PackingRow> packing
    ) {

        public ResolvedReward {
            loot = List.copyOf(loot);
            packing = List.copyOf(packing);
        }
    }
}
