package src.domain.sessionplanner.published;

public record RemoveSessionLootPlaceholderCommand(long lootId) implements SessionPlannerCommand {

    public RemoveSessionLootPlaceholderCommand {
        lootId = Math.max(0L, lootId);
    }
}
