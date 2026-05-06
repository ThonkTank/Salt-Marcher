package src.domain.sessionplanner.session.value;

import java.util.Objects;

public final class SessionRestPlacement {

    private static final String SHORT_REST_CODE = "SHORT_REST";
    private static final String LONG_REST_CODE = "LONG_REST";

    private final long leftEncounterId;
    private final long rightEncounterId;
    private final boolean longRest;

    private SessionRestPlacement(long leftEncounterId, long rightEncounterId, boolean longRest) {
        this.leftEncounterId = Math.max(1L, leftEncounterId);
        this.rightEncounterId = Math.max(1L, rightEncounterId);
        this.longRest = longRest;
    }

    public static SessionRestPlacement shortRestBetween(long leftEncounterId, long rightEncounterId) {
        return new SessionRestPlacement(leftEncounterId, rightEncounterId, false);
    }

    public static SessionRestPlacement longRestBetween(long leftEncounterId, long rightEncounterId) {
        return new SessionRestPlacement(leftEncounterId, rightEncounterId, true);
    }

    public static SessionRestPlacement fromPersistence(long leftEncounterId, long rightEncounterId, String persistedKind) {
        if (LONG_REST_CODE.equals(Objects.requireNonNullElse(persistedKind, ""))) {
            return longRestBetween(leftEncounterId, rightEncounterId);
        }
        return shortRestBetween(leftEncounterId, rightEncounterId);
    }

    public long leftEncounterId() {
        return leftEncounterId;
    }

    public long rightEncounterId() {
        return rightEncounterId;
    }

    public boolean isShortRest() {
        return !longRest;
    }

    public boolean isLongRest() {
        return longRest;
    }

    public String persistenceKind() {
        return longRest ? LONG_REST_CODE : SHORT_REST_CODE;
    }
}
