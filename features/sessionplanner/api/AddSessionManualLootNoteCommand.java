package features.sessionplanner.api;

public record AddSessionManualLootNoteCommand(
        SessionPlannerAuthoredTarget target,
        long sceneId,
        String authoredText
) {

    public AddSessionManualLootNoteCommand {
        if (target == null) {
            throw new IllegalArgumentException("authored target is required");
        }
        if (sceneId <= 0L) {
            throw new IllegalArgumentException("scene id must be positive");
        }
        authoredText = authoredText == null ? "" : authoredText.trim();
        if (authoredText.isBlank()) {
            throw new IllegalArgumentException("authored text must not be blank");
        }
    }
}
