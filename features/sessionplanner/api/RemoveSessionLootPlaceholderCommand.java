package features.sessionplanner.api;

public record RemoveSessionLootPlaceholderCommand(long lootId) {

    public RemoveSessionLootPlaceholderCommand {
        lootId = Math.max(0L, lootId);
    }
}
