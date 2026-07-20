package features.sessionplanner.api;

public record UpdateSessionManualLootNoteCommand(
        SessionPlannerAuthoredTarget target,
        long sceneId,
        long noteId,
        String authoredText
) {

    public UpdateSessionManualLootNoteCommand {
        if (target == null) {
            throw new IllegalArgumentException("authored target is required");
        }
        if (sceneId <= 0L) {
            throw new IllegalArgumentException("scene id must be positive");
        }
        if (noteId <= 0L) {
            throw new IllegalArgumentException("note id must be positive");
        }
        authoredText = authoredText == null ? "" : authoredText.trim();
        if (authoredText.isBlank()) {
            throw new IllegalArgumentException("authored text must not be blank");
        }
    }
}
