package features.encountertable.adapter.sqlite.model;

import org.jspecify.annotations.Nullable;

public record EncounterTableSummaryRecord(
        long tableId,
        String name,
        @Nullable Long linkedLootTableId
) {
}
