package features.worldplanner.adapter.sqlite.model;

public record WorldFactionInventoryLimitRecord(
        long creatureStatblockId,
        boolean finite,
        int quantity
) { }
