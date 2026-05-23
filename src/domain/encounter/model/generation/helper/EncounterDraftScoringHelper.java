package src.domain.encounter.model.generation.helper;

import java.util.List;
import java.util.Map;
import src.domain.encounter.model.generation.model.EncounterDraftGenerationModel;

public final class EncounterDraftScoringHelper {

    private EncounterDraftScoringHelper() {
    }

    public static int score(EncounterDraftGenerationModel.ScoreInput input) {
        EncounterDraftGenerationModel.ScoreContext context = input.context();
        return new EncounterDraftGenerationModel(
                context.targetDifficulty(),
                context.thresholds(),
                context.partySize(),
                context.tuning(),
                List.of(),
                Map.of(),
                List.of()).score(input);
    }
}
