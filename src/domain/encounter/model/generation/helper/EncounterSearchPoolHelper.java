package src.domain.encounter.model.generation.helper;

import java.util.List;
import java.util.Map;
import src.domain.encounter.model.generation.model.EncounterCandidateProfile;
import src.domain.encounter.model.generation.model.EncounterDifficultyIntent;
import src.domain.encounter.model.generation.model.EncounterDifficultyThresholds;
import src.domain.encounter.model.generation.model.EncounterDraftGenerationModel;
import src.domain.encounter.model.generation.model.EncounterTuningIntent;

public final class EncounterSearchPoolHelper {

    private EncounterSearchPoolHelper() {
    }

    public static List<EncounterCandidateProfile> build(
            List<EncounterCandidateProfile> unlockedProfiles,
            EncounterDifficultyThresholds thresholds,
            EncounterDifficultyIntent targetDifficulty
    ) {
        return new EncounterDraftGenerationModel(
                targetDifficulty,
                thresholds,
                1,
                EncounterTuningIntent.defaultIntent(),
                List.of(),
                Map.of(),
                unlockedProfiles).buildSearchPool();
    }
}
