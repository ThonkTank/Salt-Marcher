package features.sessionplanner.api;

/** Optimistic guard for an authored mutation against one exact session root. */
public record SessionPlannerAuthoredTarget(long sessionId, long expectedRevision) {

    public SessionPlannerAuthoredTarget {
        if (sessionId <= 0L) {
            throw new IllegalArgumentException("session id must be positive");
        }
        if (expectedRevision <= 0L) {
            throw new IllegalArgumentException("expected revision must be positive");
        }
    }
}
