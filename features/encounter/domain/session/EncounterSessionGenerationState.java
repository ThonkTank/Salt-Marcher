package features.encounter.domain.session;

import java.util.List;
import features.encounter.domain.generation.EncounterGenerationInputs;

record EncounterSessionGenerationState(
        EncounterGenerationInputs builderInputs,
        List<GeneratedEncounterData> generatedAlternatives,
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
        generatedAlternatives = generatedAlternatives == null ? List.of() : List.copyOf(generatedAlternatives);
        generatedAdvisories = generatedAdvisories == null ? List.of() : List.copyOf(generatedAdvisories);
        generatedDifficulty = generatedDifficulty == null ? "" : generatedDifficulty;
        generatedTitle = generatedTitle == null ? "" : generatedTitle;
    }
}
