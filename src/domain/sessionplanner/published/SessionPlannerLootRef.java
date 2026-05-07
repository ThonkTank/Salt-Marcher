package src.domain.sessionplanner.published;

public record SessionPlannerLootRef(long lootId) {

    public SessionPlannerLootRef {
        lootId = Math.max(0L, lootId);
    }
}
