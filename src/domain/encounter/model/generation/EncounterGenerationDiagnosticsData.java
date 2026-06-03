package src.domain.encounter.model.generation;

public record EncounterGenerationDiagnosticsData(
        src.domain.encounter.model.generation.EncounterDifficultyIntent resolvedDifficulty,
        src.domain.encounter.model.generation.EncounterTuningIntent resolvedTuning,
        int candidatePoolSize,
        int attempts,
        int candidateEvaluations
) {

    public EncounterGenerationDiagnosticsData {
        resolvedDifficulty = resolvedDifficulty == null
                ? src.domain.encounter.model.generation.EncounterDifficultyIntent.defaultIntent()
                : resolvedDifficulty;
        resolvedTuning = resolvedTuning == null
                ? src.domain.encounter.model.generation.EncounterTuningIntent.defaultIntent()
                : resolvedTuning;
        candidatePoolSize = Math.max(0, candidatePoolSize);
        attempts = Math.max(0, attempts);
        candidateEvaluations = Math.max(0, candidateEvaluations);
    }
}
