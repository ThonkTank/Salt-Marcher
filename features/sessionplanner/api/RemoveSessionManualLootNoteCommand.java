package features.sessionplanner.api;

public record RemoveSessionManualLootNoteCommand(
        SessionPlannerAuthoredTarget target,
        long sceneId,
        long noteId
) {

    public RemoveSessionManualLootNoteCommand {
        if (target == null) {
            throw new IllegalArgumentException("authored target is required");
        }
        if (sceneId <= 0L) {
            throw new IllegalArgumentException("scene id must be positive");
        }
        if (noteId <= 0L) {
            throw new IllegalArgumentException("note id must be positive");
        }
    }
}
