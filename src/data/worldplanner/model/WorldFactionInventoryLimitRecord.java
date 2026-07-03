package src.data.worldplanner.model;

public record WorldFactionInventoryLimitRecord(
        long creatureStatblockId,
        boolean finite,
        int quantity
) { }
