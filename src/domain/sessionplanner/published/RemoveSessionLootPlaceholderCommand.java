package src.domain.sessionplanner.published;

public final class RemoveSessionLootPlaceholderCommand {

    private final long lootId;

    public RemoveSessionLootPlaceholderCommand(long lootId) {
        this.lootId = Math.max(0L, lootId);
    }

    public long lootId() {
        return lootId;
    }
}
