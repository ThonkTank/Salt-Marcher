package src.view.leftbartabs.sessionplanner;

public record SessionPlannerLootMainViewInputEvent(
        Source source,
        long lootToken
) {

    public SessionPlannerLootMainViewInputEvent {
        source = source == null ? Source.ADD_LOOT_BUTTON : source;
        lootToken = Math.max(0L, lootToken);
    }

    enum Source {
        ADD_LOOT_BUTTON,
        REMOVE_LOOT_BUTTON
    }
}
