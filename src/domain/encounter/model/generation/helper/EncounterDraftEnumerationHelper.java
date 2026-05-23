package src.domain.encounter.model.generation.helper;

import java.util.List;
import src.domain.encounter.model.generation.model.EncounterDraft;
import src.domain.encounter.model.generation.model.EncounterDraftBuildRequest;
import src.domain.encounter.model.generation.model.EncounterDraftGenerationModel;

final class EncounterDraftEnumerationHelper {

    private EncounterDraftEnumerationHelper() {
    }

    static List<EncounterDraft> enumerate(EncounterDraftBuildRequest request) {
        return generationFor(request).enumerate(request);
    }

    private static EncounterDraftGenerationModel generationFor(EncounterDraftBuildRequest request) {
        return new EncounterDraftGenerationModel(
                request.targetDifficulty(),
                request.thresholds(),
                request.partySize(),
                request.tuning(),
                request.lockedProfiles(),
                request.lockedQuantities(),
                request.pool());
    }
}
