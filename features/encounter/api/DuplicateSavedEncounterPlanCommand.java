package features.encounter.api;

public record DuplicateSavedEncounterPlanCommand(long sourcePlanId) {
    public DuplicateSavedEncounterPlanCommand {
        if (sourcePlanId <= 0L) {
            throw new IllegalArgumentException("source plan id must be positive");
        }
    }
}
