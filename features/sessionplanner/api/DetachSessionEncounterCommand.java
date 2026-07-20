package features.sessionplanner.api;

public record DetachSessionEncounterCommand(SessionPlannerAuthoredTarget target, long sceneToken) {

    public DetachSessionEncounterCommand {
        if (target == null) {
            throw new IllegalArgumentException("authored target is required");
        }
        if (sceneToken <= 0L) {
            throw new IllegalArgumentException("scene id must be positive");
        }
    }
}
