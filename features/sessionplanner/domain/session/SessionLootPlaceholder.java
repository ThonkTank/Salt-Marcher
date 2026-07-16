package features.sessionplanner.domain.session;

public record SessionLootPlaceholder(
        long lootId,
        long encounterId,
        String label
) {

    public SessionLootPlaceholder {
        lootId = Math.max(0L, lootId);
        encounterId = Math.max(0L, encounterId);
        label = label == null ? "" : label.trim();
    }
}
