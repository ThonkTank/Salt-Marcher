package src.domain.encounter.model.generation.helper;

import src.domain.encounter.model.generation.EncounterDifficultyBandModel;
import src.domain.encounter.model.generation.EncounterDifficultyThresholds;

public final class EncounterDifficultyTargetHelper {

    private EncounterDifficultyTargetHelper() {
    }

    public static double multiplierFor(int monsterCount, int partySize) {
        return EncounterDifficultyBandModel.multiplierFor(monsterCount, partySize);
    }

    public static int candidateMaxXp(EncounterDifficultyThresholds thresholds) {
        return EncounterDifficultyBandModel.candidateMaxXp(thresholds);
    }
}
