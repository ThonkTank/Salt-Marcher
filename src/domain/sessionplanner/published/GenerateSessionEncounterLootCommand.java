package src.domain.sessionplanner.published;

public record GenerateSessionEncounterLootCommand(Integer encounterCount, long seed) {
    public GenerateSessionEncounterLootCommand {
        if (encounterCount != null && (encounterCount < 1 || encounterCount > 10)) {
            throw new IllegalArgumentException("encounterCount must be between 1 and 10");
        }
        if (seed < 0) throw new IllegalArgumentException("seed must not be negative");
    }
}
