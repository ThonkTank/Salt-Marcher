package src.data.sessionplanner.model;

public record SessionLootPlaceholderRecord(
        long lootId,
        String label,
        int sortOrder
) {

    public SessionLootPlaceholderRecord {
        lootId = Math.max(0L, lootId);
        label = label == null ? "" : label.trim();
        sortOrder = Math.max(0, sortOrder);
    }
}
