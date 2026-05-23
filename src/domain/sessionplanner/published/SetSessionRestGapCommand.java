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

    public static SetSessionRestGapCommand fromKey(
            long leftEncounterId,
            long rightEncounterId,
            String restKindKey
    ) {
        return new SetSessionRestGapCommand(
                leftEncounterId,
                rightEncounterId,
                restKindFromKey(restKindKey));
    }

    private static SessionPlannerRestKind restKindFromKey(String restKindKey) {
        if (restKindKey == null || restKindKey.isBlank()) {
            return SessionPlannerRestKind.SHORT_REST;
        }
        try {
            return SessionPlannerRestKind.valueOf(restKindKey);
        } catch (IllegalArgumentException ignored) {
            return SessionPlannerRestKind.SHORT_REST;
        }
    }
}
