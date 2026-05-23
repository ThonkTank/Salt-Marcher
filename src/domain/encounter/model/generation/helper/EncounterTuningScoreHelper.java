package src.domain.encounter.model.generation.helper;

import src.domain.encounter.model.generation.model.EncounterDraftComposition;
import src.domain.encounter.model.generation.model.EncounterDraftGenerationModel;
import src.domain.encounter.model.generation.model.EncounterTuningIntent;

final class EncounterTuningScoreHelper {

    private EncounterTuningScoreHelper() {
    }

    static int score(EncounterDraftComposition composition, EncounterTuningIntent tuning, int partySize) {
        return new EncounterDraftGenerationModel(
                src.domain.encounter.model.generation.model.EncounterDifficultyIntent.EASY,
                new src.domain.encounter.model.generation.model.EncounterDifficultyThresholds(1, 1, 1, 1),
                partySize,
                tuning,
                java.util.List.of(),
                java.util.Map.of(),
                java.util.List.of()).tuningScore(composition);
    }
}
