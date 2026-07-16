package features.worldplanner.api;

public record WorldFactionInventoryLimitSummary(
        long creatureStatblockId,
        boolean finite,
        int quantity
) {

    public WorldFactionInventoryLimitSummary {
        if (finite && quantity < 0) {
            throw new IllegalArgumentException("finite quantity must be non-negative");
        }
        quantity = finite ? quantity : 0;
    }

}
