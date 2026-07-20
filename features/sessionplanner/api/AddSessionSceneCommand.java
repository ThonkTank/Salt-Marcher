package features.sessionplanner.api;

public record AddSessionSceneCommand(SessionPlannerAuthoredTarget target) {

    public AddSessionSceneCommand {
        if (target == null) {
            throw new IllegalArgumentException("authored target is required");
        }
    }
}
