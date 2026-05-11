package src.domain.encountertable.model.catalog.model;

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
