package src.domain.sessionplanner.published;

public final class ClearSessionRestGapCommand {

    private final long leftEncounterId;
    private final long rightEncounterId;

    public ClearSessionRestGapCommand(long leftEncounterId, long rightEncounterId) {
        this.leftEncounterId = Math.max(0L, leftEncounterId);
        this.rightEncounterId = Math.max(0L, rightEncounterId);
    }

    public long leftEncounterId() {
        return leftEncounterId;
    }

    public long rightEncounterId() {
        return rightEncounterId;
    }
}
