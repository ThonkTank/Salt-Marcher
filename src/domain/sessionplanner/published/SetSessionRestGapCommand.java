package src.domain.sessionplanner.published;

import java.util.Objects;

public record SetSessionRestGapCommand(
        long leftEncounterId,
        long rightEncounterId,
        SessionPlannerRestKind restKind
) {

    public SetSessionRestGapCommand(
            long leftEncounterId,
            long rightEncounterId,
            SessionPlannerRestKind restKind
    ) {
        this.leftEncounterId = Math.max(0L, leftEncounterId);
        this.rightEncounterId = Math.max(0L, rightEncounterId);
        this.restKind = Objects.requireNonNull(restKind, "restKind");
    }

}
