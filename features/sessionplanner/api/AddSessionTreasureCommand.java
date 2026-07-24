package features.sessionplanner.api;

public record AddSessionTreasureCommand(
        SessionPlannerAuthoredTarget target,
        long sceneId
) {
    public AddSessionTreasureCommand {
        if (target == null || sceneId <= 0L) {
            throw new IllegalArgumentException("valid treasure target is required");
        }
    }
}
