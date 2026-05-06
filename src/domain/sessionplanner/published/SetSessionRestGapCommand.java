package src.domain.sessionplanner.published;

public final class SetSessionRestGapCommand {

    private final long leftEncounterId;
    private final long rightEncounterId;
    private final SessionPlannerRestKind restKind;

    public SetSessionRestGapCommand(
            long leftEncounterId,
            long rightEncounterId,
            SessionPlannerRestKind restKind
    ) {
        this.leftEncounterId = Math.max(0L, leftEncounterId);
        this.rightEncounterId = Math.max(0L, rightEncounterId);
        this.restKind = restKind == null ? SessionPlannerRestKind.NONE : restKind;
    }

    public long leftEncounterId() {
        return leftEncounterId;
    }

    public long rightEncounterId() {
        return rightEncounterId;
    }

    public SessionPlannerRestKind restKind() {
        return restKind;
    }
}
