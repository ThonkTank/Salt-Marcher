package src.domain.sessionplanner.published;

public record SessionPlannerRestGapChange(
        long leftEncounterId,
        long rightEncounterId,
        SessionPlannerRestKind restKind
) {

    public SessionPlannerRestGapChange {
        leftEncounterId = Math.max(0L, leftEncounterId);
        rightEncounterId = Math.max(0L, rightEncounterId);
        restKind = restKind == null ? SessionPlannerRestKind.NONE : restKind;
    }
}
