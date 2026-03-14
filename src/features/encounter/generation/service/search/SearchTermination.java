package features.encounter.generation.service.search;

import features.encounter.generation.service.search.model.RelaxationProfile;
import features.encounter.generation.service.search.model.SearchState;

record SearchTermination(
        SearchState bestState,
        RelaxationProfile relaxation,
        SearchExecutionDebugMetadata debugMetadata
) {
    boolean isExactMatch() {
        return debugMetadata != null && debugMetadata.stopReason() == SearchStopReason.EXACT_MATCH;
    }

    SearchTermination withStopReason(SearchStopReason stopReason) {
        if (debugMetadata == null) {
            return this;
        }
        return new SearchTermination(
                bestState,
                relaxation,
                new SearchExecutionDebugMetadata(
                        debugMetadata.candidatePoolSize(),
                        debugMetadata.iterations(),
                        debugMetadata.candidateEvaluations(),
                        debugMetadata.backtrackCount(),
                        debugMetadata.relaxationStage(),
                        stopReason,
                        debugMetadata.fallbackSeedUsed()));
    }
}
