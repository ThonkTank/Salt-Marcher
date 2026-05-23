package src.domain.encounter.model.generation.helper;

import java.util.List;
import src.domain.encounter.model.generation.model.EncounterDraft;
import src.domain.encounter.model.generation.model.EncounterDraftGenerationModel;

public final class EncounterDraftAssemblyHelper {

    private EncounterDraftAssemblyHelper() {
    }

    public static List<EncounterDraft> createDrafts(EncounterDraftGenerationModel request) {
        return request.createDrafts();
    }
}
