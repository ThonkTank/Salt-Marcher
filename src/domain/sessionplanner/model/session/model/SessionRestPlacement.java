package src.domain.sessionplanner.model.session.model;

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
        String effectiveKind = Objects.requireNonNullElse(persistedKind, "");
        if (SHORT_REST_CODE.equals(effectiveKind)) {
            return shortRestBetween(leftEncounterId, rightEncounterId);
        }
        if (LONG_REST_CODE.equals(effectiveKind)) {
            return longRestBetween(leftEncounterId, rightEncounterId);
        }
        throw new IllegalStateException("Malformed persisted rest kind: " + persistedKind);
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

    public boolean matchesGap(long leftEncounterId, long rightEncounterId) {
        return this.leftEncounterId == leftEncounterId && this.rightEncounterId == rightEncounterId;
    }

    public String persistenceKind() {
        return longRest ? LONG_REST_CODE : SHORT_REST_CODE;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof SessionRestPlacement that)) {
            return false;
        }
        return leftEncounterId == that.leftEncounterId
                && rightEncounterId == that.rightEncounterId
                && longRest == that.longRest;
    }

    @Override
    public int hashCode() {
        return Objects.hash(leftEncounterId, rightEncounterId, longRest);
    }
}
