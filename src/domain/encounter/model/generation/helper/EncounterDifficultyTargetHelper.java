package src.domain.encounter.model.generation.helper;

import src.domain.encounter.model.generation.model.EncounterDifficultyBandModel;
import src.domain.encounter.model.generation.model.EncounterDifficultyIntent;
import src.domain.encounter.model.generation.model.EncounterDifficultyThresholds;

public final class EncounterDifficultyTargetHelper {

    private EncounterDifficultyTargetHelper() {
    }

    public static double multiplierFor(int monsterCount, int partySize) {
        return EncounterDifficultyBandModel.multiplierFor(monsterCount, partySize);
    }

    public static EncounterDifficultyIntent bandFor(int adjustedXp, EncounterDifficultyThresholds thresholds) {
        return EncounterDifficultyBandModel.bandFor(adjustedXp, thresholds);
    }

    public static int minAdjustedXp(EncounterDifficultyIntent band, EncounterDifficultyThresholds thresholds) {
        return EncounterDifficultyBandModel.of(band, thresholds).minAdjustedXp();
    }

    public static int maxAdjustedXp(EncounterDifficultyIntent band, EncounterDifficultyThresholds thresholds) {
        return EncounterDifficultyBandModel.of(band, thresholds).maxAdjustedXp();
    }

    public static int targetAdjustedXp(EncounterDifficultyIntent band, EncounterDifficultyThresholds thresholds) {
        return EncounterDifficultyBandModel.of(band, thresholds).targetAdjustedXp();
    }

    public static int candidateMaxXp(EncounterDifficultyThresholds thresholds) {
        return EncounterDifficultyBandModel.candidateMaxXp(thresholds);
    }
}
