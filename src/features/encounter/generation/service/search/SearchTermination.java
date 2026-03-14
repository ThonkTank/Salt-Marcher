package features.encounter.generation.service.search;

import features.encounter.generation.service.search.model.RelaxationProfile;
import features.encounter.generation.service.search.model.SearchExecutionDebugMetadata;
import features.encounter.generation.service.search.model.SearchState;
import features.encounter.generation.service.search.model.SearchStopReason;

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
        return new SearchTermination(bestState, relaxation, debugMetadata.withStopReason(stopReason));
    }
}
