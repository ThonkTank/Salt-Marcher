package src.domain.encounter.model.generation.helper;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import src.domain.encounter.model.generation.model.EncounterDraft;
import src.domain.encounter.model.generation.model.EncounterDraftGenerationModel;
import src.domain.encounter.model.generation.model.EncounterDifficultyIntent;
import src.domain.encounter.model.generation.model.EncounterDifficultyThresholds;
import src.domain.encounter.model.generation.model.EncounterTuningIntent;

public final class EncounterDraftOrderingHelper {

    private EncounterDraftOrderingHelper() {
    }

    public static List<EncounterDraft> topDrafts(Collection<EncounterDraft> drafts, int limit) {
        return new EncounterDraftGenerationModel(
                EncounterDifficultyIntent.EASY,
                new EncounterDifficultyThresholds(1, 1, 1, 1),
                1,
                EncounterTuningIntent.defaultIntent(),
                List.of(),
                Map.of(),
                List.of()).topDrafts(drafts, limit);
    }
}
