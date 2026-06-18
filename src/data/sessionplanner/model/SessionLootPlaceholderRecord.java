package src.data.sessionplanner.model;

public record SessionLootPlaceholderRecord(
        long lootId,
        long encounterId,
        String label,
        int sortOrder
) {

    public SessionLootPlaceholderRecord {
        lootId = Math.max(0L, lootId);
        encounterId = Math.max(0L, encounterId);
        label = label == null ? "" : label.trim();
        sortOrder = Math.max(0, sortOrder);
    }
}
