package features.encounter.domain.generation;

public record EncounterGenerationAttempt(
        EncounterDifficultyIntent targetDifficulty,
        EncounterTuningIntent tuning,
        boolean autoResolved
) {

    public EncounterGenerationAttempt {
        targetDifficulty = targetDifficulty == null ? EncounterDifficultyIntent.MEDIUM : targetDifficulty;
        tuning = tuning == null ? EncounterTuningIntent.defaultIntent() : tuning;
    }
}
