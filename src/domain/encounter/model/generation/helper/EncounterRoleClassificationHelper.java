package src.domain.encounter.model.generation.helper;

import src.domain.encounter.model.generation.EncounterCreatureFacts;
import src.domain.encounter.model.generation.EncounterRoleClassification;

public final class EncounterRoleClassificationHelper {

    private EncounterRoleClassificationHelper() {
    }

    public static EncounterRoleClassification classify(EncounterCreatureFacts candidate) {
        return EncounterRoleClassification.classify(candidate);
    }
}
