package features.sessionplanner.api;

public record UpdateSessionEncounterSceneCommand(
        SessionPlannerAuthoredTarget target,
        long encounterId,
        String sceneTitle,
        String sceneNotes,
        long locationId
) {

    public UpdateSessionEncounterSceneCommand {
        if (target == null) {
            throw new IllegalArgumentException("authored target is required");
        }
        if (encounterId <= 0L) {
            throw new IllegalArgumentException("encounter id must be positive");
        }
        sceneTitle = sceneTitle == null ? "" : sceneTitle.trim();
        sceneNotes = sceneNotes == null ? "" : sceneNotes.trim();
        locationId = Math.max(0L, locationId);
    }
}
