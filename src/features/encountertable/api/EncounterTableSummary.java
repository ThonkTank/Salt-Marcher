package features.encountertable.api;

public record EncounterTableSummary(
        long tableId,
        String name,
        String linkedLootTableName,
        String lootWarning,
        int entryCount
) {}
