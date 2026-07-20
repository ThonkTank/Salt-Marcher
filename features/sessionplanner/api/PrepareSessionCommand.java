package features.sessionplanner.api;

import java.util.Objects;
import java.util.OptionalInt;

public record PrepareSessionCommand(
        SessionPlannerAuthoredTarget target,
        OptionalInt encounterCount,
        long seed,
        boolean replacementConfirmed
) {

    public PrepareSessionCommand {
        target = Objects.requireNonNull(target, "target");
        encounterCount = Objects.requireNonNull(encounterCount, "encounterCount");
        if (encounterCount.isPresent()
                && (encounterCount.getAsInt() < 1 || encounterCount.getAsInt() > 10)) {
            throw new IllegalArgumentException("encounter count must be between 1 and 10");
        }
        if (seed < 0L) {
            throw new IllegalArgumentException("seed must not be negative");
        }
    }
}
