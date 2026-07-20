package features.catalog.application;

import java.util.Objects;

public record EncounterTableCatalogRow(long tableId, String name, String details) {
    public EncounterTableCatalogRow {
        tableId = Math.max(0L, tableId);
        name = Objects.requireNonNullElse(name, "");
        details = Objects.requireNonNullElse(details, "");
    }
}
