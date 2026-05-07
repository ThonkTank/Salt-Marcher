package src.domain.sessionplanner.published;

public record SessionPlannerRestGapRef(
        long leftEncounterId,
        long rightEncounterId
) {

    public SessionPlannerRestGapRef {
        leftEncounterId = Math.max(0L, leftEncounterId);
        rightEncounterId = Math.max(0L, rightEncounterId);
    }
}
