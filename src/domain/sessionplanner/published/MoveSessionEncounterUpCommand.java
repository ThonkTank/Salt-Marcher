package src.domain.sessionplanner.published;

public final class MoveSessionEncounterUpCommand {

    private final long encounterId;

    public MoveSessionEncounterUpCommand(long encounterId) {
        this.encounterId = Math.max(0L, encounterId);
    }

    public long encounterId() {
        return encounterId;
    }
}
