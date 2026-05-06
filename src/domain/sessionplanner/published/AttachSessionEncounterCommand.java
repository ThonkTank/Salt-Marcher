package src.domain.sessionplanner.published;

public record AttachSessionEncounterCommand(long encounterPlanId) {

    public AttachSessionEncounterCommand {
        encounterPlanId = Math.max(0L, encounterPlanId);
    }
}
