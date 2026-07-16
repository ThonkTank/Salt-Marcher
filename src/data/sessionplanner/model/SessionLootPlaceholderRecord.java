package src.data.sessionplanner.model;

public record SessionLootPlaceholderRecord(
        long lootId,
        long encounterId,
        String label,
        long generationId,
        long treasureId,
        int sortOrder
) {

    public SessionLootPlaceholderRecord {
        lootId = Math.max(0L, lootId);
        encounterId = Math.max(0L, encounterId);
        label = label == null ? "" : label.trim();
        generationId = Math.max(0L, generationId);
        treasureId = Math.max(0L, treasureId);
        sortOrder = Math.max(0, sortOrder);
    }

    public SessionLootPlaceholderRecord(long lootId, long encounterId, String label, int sortOrder) {
        this(lootId, encounterId, label, 0L, 0L, sortOrder);
    }
}
