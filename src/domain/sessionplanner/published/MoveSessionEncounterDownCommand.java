package src.domain.sessionplanner.published;

public final class MoveSessionEncounterDownCommand {

    private final long encounterId;

    public MoveSessionEncounterDownCommand(long encounterId) {
        this.encounterId = Math.max(0L, encounterId);
    }

    public long encounterId() {
        return encounterId;
    }
}
