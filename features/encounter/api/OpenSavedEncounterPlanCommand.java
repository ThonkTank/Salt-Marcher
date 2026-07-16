package features.encounter.api;

public record OpenSavedEncounterPlanCommand(long planId, boolean discardUnsavedChanges) {

    public OpenSavedEncounterPlanCommand {
        planId = Math.max(0L, planId);
    }
}
