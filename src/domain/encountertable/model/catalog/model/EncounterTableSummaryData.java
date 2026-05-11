package src.domain.encountertable.model.catalog.model;

import org.jspecify.annotations.Nullable;

public final class EncounterTableSummaryData {
    private final long tableId;
    private final String name;
    private final @Nullable Long linkedLootTableId;

    public EncounterTableSummaryData(long tableId, String name, @Nullable Long linkedLootTableId) {
        this.tableId = tableId;
        this.name = name == null ? "" : name;
        this.linkedLootTableId = linkedLootTableId;
    }

    public long tableId() {
        return tableId;
    }

    public String name() {
        return name;
    }

    public @Nullable Long linkedLootTableId() {
        return linkedLootTableId;
    }
}
