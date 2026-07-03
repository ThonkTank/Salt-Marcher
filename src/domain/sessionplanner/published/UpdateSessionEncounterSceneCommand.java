package src.domain.sessionplanner.published;

public record UpdateSessionEncounterSceneCommand(
        long encounterId,
        String sceneTitle,
        String sceneNotes,
        long locationId
) {

    public UpdateSessionEncounterSceneCommand {
        encounterId = Math.max(0L, encounterId);
        sceneTitle = sceneTitle == null ? "" : sceneTitle.trim();
        sceneNotes = sceneNotes == null ? "" : sceneNotes.trim();
        locationId = Math.max(0L, locationId);
    }
}
