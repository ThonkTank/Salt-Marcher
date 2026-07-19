package features.catalog.application;

import java.util.List;
import java.util.Objects;

/** Temporary M3 presentation projection; browse truth lives in CatalogSectionState. */
public record EncounterTableCatalogState(
        long revision,
        CatalogResultState<EncounterTableRow> results,
        long selectedTableId,
        String query,
        List<CatalogReferenceOption> options
) {
    public EncounterTableCatalogState {
        revision = Math.max(0L, revision);
        results = Objects.requireNonNull(results, "results");
        selectedTableId = Math.max(0L, selectedTableId);
        query = Objects.requireNonNullElse(query, "");
        options = List.copyOf(Objects.requireNonNull(options, "options"));
    }

    static EncounterTableCatalogState initial() {
        return new EncounterTableCatalogState(
                0L, CatalogResultState.uninitialized(), 0L, "", List.of());
    }

    public record EncounterTableRow(long tableId, String name, String details) {
        public EncounterTableRow {
            tableId = Math.max(0L, tableId);
            name = Objects.requireNonNullElse(name, "");
            details = Objects.requireNonNullElse(details, "");
        }
    }
}
