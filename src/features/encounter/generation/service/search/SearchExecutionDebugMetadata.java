package features.encounter.generation.service.search;

import java.util.Objects;

record SearchExecutionDebugMetadata(
        int candidatePoolSize,
        int iterations,
        int candidateEvaluations,
        int backtrackCount,
        int relaxationStage,
        SearchStopReason stopReason,
        boolean fallbackSeedUsed
) {
    SearchExecutionDebugMetadata {
        stopReason = Objects.requireNonNull(stopReason, "stopReason");
    }
}
