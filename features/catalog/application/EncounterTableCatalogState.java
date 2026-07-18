package features.catalog.application;

import features.encountertable.api.EncounterTableSummary;
import java.util.Objects;

public record EncounterTableCatalogState(
        CatalogResultState<EncounterTableSummary> results,
        long selectedTableId,
        String query
) {
    public EncounterTableCatalogState {
        results = Objects.requireNonNull(results, "results");
        selectedTableId = Math.max(0L, selectedTableId);
        query = Objects.requireNonNull(query, "query");
    }

    static EncounterTableCatalogState initial() {
        return new EncounterTableCatalogState(CatalogResultState.loading(), 0L, "");
    }
}
