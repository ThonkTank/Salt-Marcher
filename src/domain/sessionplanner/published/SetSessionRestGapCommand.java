package src.domain.sessionplanner.published;

import java.util.Objects;

public record SetSessionRestGapCommand(
        long leftEncounterId,
        long rightEncounterId,
        SessionPlannerRestKind restKind
) {

    public SetSessionRestGapCommand {
        leftEncounterId = Math.max(0L, leftEncounterId);
        rightEncounterId = Math.max(0L, rightEncounterId);
        restKind = Objects.requireNonNull(restKind, "restKind");
    }
}
