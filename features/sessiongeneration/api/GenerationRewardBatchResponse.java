package features.sessiongeneration.api;

import java.util.List;
import java.util.Objects;

public record GenerationRewardBatchResponse(
        GenerationStatus status,
        String message,
        List<ResolvedReward> resolved,
        List<GenerationRewardReference> missing
) {

    public GenerationRewardBatchResponse {
        status = Objects.requireNonNull(status, "status");
        message = Objects.requireNonNullElse(message, "");
        resolved = List.copyOf(resolved);
        missing = List.copyOf(missing);
        if (status != GenerationStatus.SUCCESS && (!resolved.isEmpty() || !missing.isEmpty())) {
            throw new IllegalArgumentException("failed reward response must not expose partial results");
        }
    }

    public static GenerationRewardBatchResponse success(
            List<ResolvedReward> resolved,
            List<GenerationRewardReference> missing
    ) {
        return new GenerationRewardBatchResponse(GenerationStatus.SUCCESS, "", resolved, missing);
    }

    public static GenerationRewardBatchResponse failure(GenerationStatus status, String message) {
        return new GenerationRewardBatchResponse(status, message, List.of(), List.of());
    }

    public record ResolvedReward(
            GenerationRewardReference reference,
            GenerationResult.Treasure treasure,
            List<GenerationResult.LootItem> lootItems,
            List<GenerationResult.Packing> packing
    ) {

        public ResolvedReward {
            reference = Objects.requireNonNull(reference, "reference");
            treasure = Objects.requireNonNull(treasure, "treasure");
            lootItems = List.copyOf(lootItems);
            packing = List.copyOf(packing);
        }
    }
}
