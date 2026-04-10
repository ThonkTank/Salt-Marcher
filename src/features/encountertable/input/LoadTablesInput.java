package features.encountertable.input;

import java.util.List;

@SuppressWarnings("unused")
public record LoadTablesInput() {

    public record TableSummaryInput(
            long tableId,
            String name,
            String description,
            Long linkedLootTableId
    ) {
    }

    public record LoadedTablesInput(
            boolean success,
            List<TableSummaryInput> tables
    ) {
    }
}
