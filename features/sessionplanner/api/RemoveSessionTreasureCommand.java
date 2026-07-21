package features.sessionplanner.api;

public record RemoveSessionTreasureCommand(
        SessionPlannerAuthoredTarget target,
        long sceneId,
        long treasureId
) {
    public RemoveSessionTreasureCommand {
        if (target == null || sceneId <= 0L || treasureId <= 0L) {
            throw new IllegalArgumentException("valid treasure target is required");
        }
    }
}
