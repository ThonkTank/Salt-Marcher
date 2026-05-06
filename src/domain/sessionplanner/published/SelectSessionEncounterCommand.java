package src.domain.sessionplanner.published;

public final class SelectSessionEncounterCommand {

    private final long encounterId;

    public SelectSessionEncounterCommand(long encounterId) {
        this.encounterId = Math.max(0L, encounterId);
    }

    public long encounterId() {
        return encounterId;
    }
}
