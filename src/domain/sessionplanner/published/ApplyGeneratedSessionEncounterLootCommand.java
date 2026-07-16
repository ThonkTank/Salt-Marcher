package src.domain.sessionplanner.published;

public record ApplyGeneratedSessionEncounterLootCommand(long generationId) {
    public ApplyGeneratedSessionEncounterLootCommand {
        if (generationId <= 0) throw new IllegalArgumentException("generationId must be positive");
    }
}
