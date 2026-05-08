package src.domain.encounter.application;

record EncounterGenerationDiagnosticsData(
        src.domain.encounter.generation.value.EncounterDifficultyIntent resolvedDifficulty,
        src.domain.encounter.generation.value.EncounterTuningIntent resolvedTuning,
        int candidatePoolSize,
        int attempts,
        int candidateEvaluations
) {

    EncounterGenerationDiagnosticsData {
        resolvedDifficulty = resolvedDifficulty == null
                ? src.domain.encounter.generation.value.EncounterDifficultyIntent.defaultIntent()
                : resolvedDifficulty;
        resolvedTuning = resolvedTuning == null
                ? src.domain.encounter.generation.value.EncounterTuningIntent.defaultIntent()
                : resolvedTuning;
        candidatePoolSize = Math.max(0, candidatePoolSize);
        attempts = Math.max(0, attempts);
        candidateEvaluations = Math.max(0, candidateEvaluations);
    }
}
