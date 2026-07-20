package features.sessionplanner.adapter.sqlite.model;

public record SessionManualLootNoteRecord(long noteId, long sceneId, String noteText, int sortOrder) {

    public SessionManualLootNoteRecord {
        if (noteId <= 0L || sceneId <= 0L || sortOrder < 0) {
            throw new IllegalArgumentException("manual loot note record is invalid");
        }
        noteText = noteText == null ? "" : noteText.trim();
        if (noteText.isEmpty()) {
            throw new IllegalArgumentException("manual loot note text must not be blank");
        }
    }
}
