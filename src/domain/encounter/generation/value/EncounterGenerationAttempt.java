package src.domain.encounter.generation.value;

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
