package src.domain.sessionplanner.published;

public final class RemoveSessionEncounterCommand {

    private final long encounterId;

    public RemoveSessionEncounterCommand(long encounterId) {
        this.encounterId = Math.max(0L, encounterId);
    }

    public long encounterId() {
        return encounterId;
    }
}
