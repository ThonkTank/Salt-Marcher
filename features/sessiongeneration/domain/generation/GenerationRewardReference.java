package features.sessiongeneration.domain.generation;

import java.util.Objects;

public record GenerationRewardReference(String runId, int treasureId) {

    public GenerationRewardReference {
        runId = Objects.requireNonNull(runId, "runId").trim();
        if (runId.isEmpty()) {
            throw new IllegalArgumentException("run id must not be empty");
        }
        if (treasureId <= 0) {
            throw new IllegalArgumentException("treasure id must be positive");
        }
    }
}
