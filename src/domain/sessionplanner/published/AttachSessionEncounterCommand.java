package src.domain.sessionplanner.published;

public final class AttachSessionEncounterCommand {

    private final long encounterPlanId;

    public AttachSessionEncounterCommand(long encounterPlanId) {
        this.encounterPlanId = Math.max(0L, encounterPlanId);
    }

    public long encounterPlanId() {
        return encounterPlanId;
    }
}
