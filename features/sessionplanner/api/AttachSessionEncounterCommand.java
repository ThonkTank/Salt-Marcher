package features.sessionplanner.api;

public record AttachSessionEncounterCommand(long sceneToken, long encounterPlanId) {

    public AttachSessionEncounterCommand {
        sceneToken = Math.max(0L, sceneToken);
        encounterPlanId = Math.max(0L, encounterPlanId);
    }
}
