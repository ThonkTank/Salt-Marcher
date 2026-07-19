package features.sessionplanner.api;

public record RemoveSessionManualLootNoteCommand(long noteId) {

    public RemoveSessionManualLootNoteCommand {
        if (noteId <= 0L) {
            throw new IllegalArgumentException("note id must be positive");
        }
    }
}
