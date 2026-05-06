package src.domain.sessionplanner.session.value;

public record SessionLootPlaceholder(
        long lootId,
        String label
) {

    public SessionLootPlaceholder {
        lootId = Math.max(0L, lootId);
        label = label == null ? "" : label.trim();
    }
}
