package features.encounter.generation.service.search.model;

import java.util.Objects;

public record SearchExecutionDebugMetadata(
        int candidatePoolSize,
        int iterations,
        int candidateEvaluations,
        int backtrackCount,
        int relaxationStage,
        SearchStopReason stopReason,
        boolean fallbackSeedUsed
) {
    public SearchExecutionDebugMetadata {
        stopReason = Objects.requireNonNull(stopReason, "stopReason");
    }
}
