package features.sessionplanner.api;

public record AttachSessionEncounterCommand(
        SessionPlannerAuthoredTarget target,
        long sceneToken,
        long encounterPlanId
) {

    public AttachSessionEncounterCommand {
        if (target == null) {
            throw new IllegalArgumentException("authored target is required");
        }
        if (sceneToken <= 0L || encounterPlanId <= 0L) {
            throw new IllegalArgumentException("scene and encounter plan ids must be positive");
        }
    }
}
