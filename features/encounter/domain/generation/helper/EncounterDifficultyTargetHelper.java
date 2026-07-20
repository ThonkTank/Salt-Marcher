package features.encounter.domain.generation.helper;

import features.encounter.domain.generation.EncounterDifficultyBandModel;
import features.encounter.domain.generation.EncounterDifficultyThresholds;

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
