package features.encountertable.api;

import org.jspecify.annotations.Nullable;

public record EncounterTableSummary(
        long tableId,
        String name,
        @Nullable Long linkedLootTableId
) {

    public EncounterTableSummary {
        name = name == null ? "" : name;
    }
}
