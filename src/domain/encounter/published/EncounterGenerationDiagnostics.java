package src.domain.encounter.published;

public record EncounterGenerationDiagnostics(
        EncounterDifficultyBand resolvedDifficulty,
        EncounterGenerationTuning resolvedTuning,
        EncounterGenerationSolutionQuality solutionQuality,
        EncounterGenerationStopCategory stopCategory,
        int candidatePoolSize,
        int attempts,
        int candidateEvaluations
) {

    public EncounterGenerationDiagnostics {
        resolvedDifficulty = resolvedDifficulty == null ? EncounterDifficultyBand.defaultBand() : resolvedDifficulty;
        resolvedTuning = resolvedTuning == null ? EncounterGenerationTuning.defaultTuning() : resolvedTuning;
        solutionQuality = solutionQuality == null ? EncounterGenerationSolutionQuality.FALLBACK : solutionQuality;
        stopCategory = stopCategory == null ? EncounterGenerationStopCategory.SEARCH_EXHAUSTED : stopCategory;
        candidatePoolSize = Math.max(0, candidatePoolSize);
        attempts = Math.max(0, attempts);
        candidateEvaluations = Math.max(0, candidateEvaluations);
    }
}
