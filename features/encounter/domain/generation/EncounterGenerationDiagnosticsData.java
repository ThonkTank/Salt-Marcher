package features.encounter.domain.generation;

public record EncounterGenerationDiagnosticsData(
        features.encounter.domain.generation.EncounterDifficultyIntent resolvedDifficulty,
        features.encounter.domain.generation.EncounterTuningIntent resolvedTuning,
        int candidatePoolSize,
        int attempts,
        int candidateEvaluations
) {

    public EncounterGenerationDiagnosticsData {
        resolvedDifficulty = resolvedDifficulty == null
                ? features.encounter.domain.generation.EncounterDifficultyIntent.defaultIntent()
                : resolvedDifficulty;
        resolvedTuning = resolvedTuning == null
                ? features.encounter.domain.generation.EncounterTuningIntent.defaultIntent()
                : resolvedTuning;
        candidatePoolSize = Math.max(0, candidatePoolSize);
        attempts = Math.max(0, attempts);
        candidateEvaluations = Math.max(0, candidateEvaluations);
    }
}
