package src.domain.encounter.published;

public record EncounterGenerationDiagnostics(
        String resolvedDifficulty,
        String resolvedTuning,
        EncounterGenerationSolutionQuality solutionQuality,
        EncounterGenerationStopCategory stopCategory,
        int candidatePoolSize,
        int attempts,
        int candidateEvaluations
) {

    public EncounterGenerationDiagnostics {
        resolvedDifficulty = resolvedDifficulty == null ? "" : resolvedDifficulty;
        resolvedTuning = resolvedTuning == null ? "" : resolvedTuning;
        solutionQuality = solutionQuality == null ? EncounterGenerationSolutionQuality.FALLBACK : solutionQuality;
        stopCategory = stopCategory == null ? EncounterGenerationStopCategory.SEARCH_EXHAUSTED : stopCategory;
        candidatePoolSize = Math.max(0, candidatePoolSize);
        attempts = Math.max(0, attempts);
        candidateEvaluations = Math.max(0, candidateEvaluations);
    }
}
