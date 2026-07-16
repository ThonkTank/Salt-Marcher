package features.encountertable.api;

import java.util.List;

public record EncounterTableCatalogResult(
        EncounterTableReadStatus status,
        List<EncounterTableSummary> tables
) {
    public EncounterTableCatalogResult {
        status = status == null ? EncounterTableReadStatus.STORAGE_ERROR : status;
        tables = tables == null ? List.of() : List.copyOf(tables);
    }
}
