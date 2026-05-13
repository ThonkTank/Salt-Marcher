package src.domain.encounter.model.session.model;

import java.util.List;
import src.domain.encounter.model.generation.model.EncounterGenerationInputs;

record EncounterSessionGenerationState(
        EncounterGenerationInputs builderInputs,
        List<String> generatedAdvisories,
        int generatedAdjustedXp,
        String generatedDifficulty,
        String generatedTitle,
        int selectedAlternativeIndex,
        int alternativeCount,
        boolean generationHistoryPresent
) {
    EncounterSessionGenerationState {
        builderInputs = builderInputs == null ? EncounterGenerationInputs.empty() : builderInputs;
        generatedAdvisories = generatedAdvisories == null ? List.of() : List.copyOf(generatedAdvisories);
        generatedDifficulty = generatedDifficulty == null ? "" : generatedDifficulty;
        generatedTitle = generatedTitle == null ? "" : generatedTitle;
    }
}
