package features.worldplanner.domain.world;

public record WorldFactionInventoryLimit(
        long creatureStatblockId,
        boolean finite,
        int quantity
) {
    public WorldFactionInventoryLimit {
        if (!WorldPlannerIds.isPositive(creatureStatblockId)) {
            throw new IllegalArgumentException("creatureStatblockId must be positive");
        }
        if (finite && quantity < 0) {
            throw new IllegalArgumentException("finite quantity must be non-negative");
        }
        quantity = finite ? quantity : 0;
    }

}
