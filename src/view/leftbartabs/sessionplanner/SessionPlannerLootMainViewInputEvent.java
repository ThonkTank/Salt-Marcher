package src.view.leftbartabs.sessionplanner;

public record SessionPlannerLootMainViewInputEvent(
        long removedLootToken
) {

    public SessionPlannerLootMainViewInputEvent {
        removedLootToken = Math.max(0L, removedLootToken);
    }
}
