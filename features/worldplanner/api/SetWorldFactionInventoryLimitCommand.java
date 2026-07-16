package features.worldplanner.api;

public record SetWorldFactionInventoryLimitCommand(
        long factionId,
        long creatureStatblockId,
        boolean finite,
        int quantity
) { }
