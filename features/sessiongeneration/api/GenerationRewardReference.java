package features.sessiongeneration.api;

import java.util.Objects;

public record GenerationRewardReference(GenerationRunId runId, int treasureId) {

    public GenerationRewardReference {
        runId = Objects.requireNonNull(runId, "runId");
        if (treasureId <= 0) {
            throw new IllegalArgumentException("treasure id must be positive");
        }
    }
}
