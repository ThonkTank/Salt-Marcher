package features.sessionplanner.api;

public record AttachSessionEncounterCommand(long encounterPlanId) {

    public AttachSessionEncounterCommand {
        encounterPlanId = Math.max(0L, encounterPlanId);
    }
}
