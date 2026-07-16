package features.encounter.domain.generation.helper;

import java.util.List;
import features.encounter.domain.generation.EncounterDraft;
import features.encounter.domain.generation.EncounterDraftGenerationModel;

public final class EncounterDraftAssemblyHelper {

    private EncounterDraftAssemblyHelper() {
    }

    public static List<EncounterDraft> createDrafts(EncounterDraftGenerationModel request) {
        return request.createDrafts();
    }
}
