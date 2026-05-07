package src.domain.encountertable.published;

import org.jspecify.annotations.Nullable;
import src.domain.encountertable.catalog.value.EncounterTableSummaryData;

public final class EncounterTableSummary {

    private final EncounterTableSummaryData data;

    public EncounterTableSummary(long tableId, String name, @Nullable Long linkedLootTableId) {
        this(new EncounterTableSummaryData(tableId, name, linkedLootTableId));
    }

    public EncounterTableSummary(EncounterTableSummaryData data) {
        this.data = data == null ? new EncounterTableSummaryData(0L, "", null) : data;
    }

    public static EncounterTableSummary fromData(EncounterTableSummaryData data) {
        return new EncounterTableSummary(data);
    }

    public long tableId() {
        return data.tableId();
    }

    public String name() {
        return data.name();
    }

    public @Nullable Long linkedLootTableId() {
        return data.linkedLootTableId();
    }
}
