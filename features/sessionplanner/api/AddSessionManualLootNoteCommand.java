package features.sessionplanner.api;

public record AddSessionManualLootNoteCommand(long sceneId) {

    public AddSessionManualLootNoteCommand {
        if (sceneId <= 0L) {
            throw new IllegalArgumentException("scene id must be positive");
        }
    }
}
