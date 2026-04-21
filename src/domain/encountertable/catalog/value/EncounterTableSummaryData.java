package src.domain.encountertable.catalog.value;

import org.jspecify.annotations.Nullable;

public record EncounterTableSummaryData(
        long tableId,
        String name,
        @Nullable Long linkedLootTableId
) {
    public EncounterTableSummaryData {
        name = name == null ? "" : name;
    }
}
