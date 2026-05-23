package src.domain.encounter.model.generation.helper;

import java.util.List;
import src.domain.encounter.model.generation.model.EncounterDraft;
import src.domain.encounter.model.generation.model.EncounterDraftBuildRequest;
import src.domain.encounter.model.generation.model.EncounterDraftComposition;
import src.domain.encounter.model.generation.model.EncounterDraftGenerationModel;

final class EncounterDraftCreationHelper {

    private EncounterDraftCreationHelper() {
    }

    static List<EncounterDraft> create(
            EncounterDraftComposition composition,
            EncounterDraftBuildRequest request
    ) {
        return new EncounterDraftGenerationModel(
                request.targetDifficulty(),
                request.thresholds(),
                request.partySize(),
                request.tuning(),
                request.lockedProfiles(),
                request.lockedQuantities(),
                request.pool()).create(composition, request);
    }
}
