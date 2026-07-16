package src.domain.sessionplanner.model.session;

public record SessionLootPlaceholder(
        long lootId,
        long encounterId,
        String label,
        long generationId,
        long treasureId
) {

    public SessionLootPlaceholder {
        lootId = Math.max(0L, lootId);
        encounterId = Math.max(0L, encounterId);
        label = label == null ? "" : label.trim();
        generationId = Math.max(0L, generationId);
        treasureId = Math.max(0L, treasureId);
        if ((generationId == 0L) != (treasureId == 0L)) {
            throw new IllegalArgumentException("Generated loot references require both IDs");
        }
    }

    public SessionLootPlaceholder(long lootId, long encounterId, String label) {
        this(lootId, encounterId, label, 0L, 0L);
    }

    public boolean generated() {
        return generationId > 0L;
    }
}
