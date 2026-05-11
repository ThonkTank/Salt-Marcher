package src.domain.encounter.published;

import src.domain.encounter.model.generation.model.EncounterDifficultyIntent;
import src.domain.encounter.model.generation.model.EncounterTuningIntent;

public record EncounterGenerationDiagnostics(
        EncounterDifficultyIntent resolvedDifficulty,
        EncounterTuningIntent resolvedTuning,
        EncounterGenerationSolutionQuality solutionQuality,
        EncounterGenerationStopCategory stopCategory,
        int candidatePoolSize,
        int attempts,
        int candidateEvaluations
) {

    public EncounterGenerationDiagnostics {
        resolvedDifficulty = resolvedDifficulty == null ? EncounterDifficultyIntent.defaultIntent() : resolvedDifficulty;
        resolvedTuning = resolvedTuning == null ? EncounterTuningIntent.defaultIntent() : resolvedTuning;
        solutionQuality = solutionQuality == null ? EncounterGenerationSolutionQuality.FALLBACK : solutionQuality;
        stopCategory = stopCategory == null ? EncounterGenerationStopCategory.SEARCH_EXHAUSTED : stopCategory;
        candidatePoolSize = Math.max(0, candidatePoolSize);
        attempts = Math.max(0, attempts);
        candidateEvaluations = Math.max(0, candidateEvaluations);
    }
}
