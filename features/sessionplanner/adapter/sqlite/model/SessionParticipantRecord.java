package features.sessionplanner.adapter.sqlite.model;

public record SessionParticipantRecord(
        long characterId,
        int sortOrder
) {

    public SessionParticipantRecord {
        characterId = Math.max(0L, characterId);
        sortOrder = Math.max(0, sortOrder);
    }
}
