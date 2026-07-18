package features.catalog.application;

import java.util.List;
import java.util.Objects;

/** Immutable application projection for the Encounter Table Catalog section. */
public record EncounterTableCatalogState(
        long revision,
        long lifecycleRevision,
        Lifecycle lifecycle,
        CatalogResultState<EncounterTableRow> results,
        long selectedTableId,
        String query,
        List<CatalogReferenceOption> options
) {

    public EncounterTableCatalogState {
        revision = Math.max(0L, revision);
        lifecycleRevision = Math.max(0L, lifecycleRevision);
        lifecycle = Objects.requireNonNull(lifecycle, "lifecycle");
        results = Objects.requireNonNull(results, "results");
        selectedTableId = Math.max(0L, selectedTableId);
        query = Objects.requireNonNullElse(query, "");
        options = List.copyOf(Objects.requireNonNull(options, "options"));
    }

    static EncounterTableCatalogState initial() {
        return new EncounterTableCatalogState(
                0L, 0L, Lifecycle.INACTIVE, CatalogResultState.loading(), 0L, "", List.of());
    }

    public record EncounterTableRow(long tableId, String name, String details) {
        public EncounterTableRow {
            tableId = Math.max(0L, tableId);
            name = Objects.requireNonNullElse(name, "");
            details = Objects.requireNonNullElse(details, "");
        }
    }

    public enum Lifecycle {
        INACTIVE,
        ACTIVE,
        CLOSED
    }
}
