package features.encounter.domain.generation.helper;

import features.encounter.domain.generation.EncounterCreatureFacts;
import features.encounter.domain.generation.EncounterRoleClassification;

public final class EncounterRoleClassificationHelper {

    private EncounterRoleClassificationHelper() {
    }

    public static EncounterRoleClassification classify(EncounterCreatureFacts candidate) {
        return EncounterRoleClassification.classify(candidate);
    }
}
