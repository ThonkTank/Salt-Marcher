package features.sessionplanner.api;

import java.util.OptionalInt;

public record PreviewGeneratedSessionCommand(OptionalInt encounterCount, long seed) {

    public PreviewGeneratedSessionCommand {
        encounterCount = encounterCount == null ? OptionalInt.empty() : encounterCount;
        if (encounterCount.isPresent()
                && (encounterCount.getAsInt() < 1 || encounterCount.getAsInt() > 10)) {
            throw new IllegalArgumentException("Encounter count must be between 1 and 10");
        }
        if (seed < 0L) {
            throw new IllegalArgumentException("Seed must not be negative");
        }
    }
}
