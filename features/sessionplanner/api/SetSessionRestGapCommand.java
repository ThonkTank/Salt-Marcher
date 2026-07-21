package features.sessionplanner.api;

import java.util.Objects;

public record SetSessionRestGapCommand(
        SessionPlannerAuthoredTarget target,
        long leftEncounterId,
        long rightEncounterId,
        SessionPlannerRestKind restKind
) {

    public SetSessionRestGapCommand {
        Objects.requireNonNull(target, "target");
        if (leftEncounterId <= 0L || rightEncounterId <= 0L) {
            throw new IllegalArgumentException("scene ids must be positive");
        }
        Objects.requireNonNull(restKind, "restKind");
    }

}
