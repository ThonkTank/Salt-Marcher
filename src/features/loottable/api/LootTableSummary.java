package features.loottable.api;

public record LootTableSummary(
        long tableId,
        String name,
        String description,
        int entryCount,
        int totalWeight
) {}
