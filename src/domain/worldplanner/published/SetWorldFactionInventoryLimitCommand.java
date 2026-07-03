package src.domain.worldplanner.published;

public record SetWorldFactionInventoryLimitCommand(
        long factionId,
        long creatureStatblockId,
        boolean finite,
        int quantity
) { }
