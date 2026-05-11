package src.domain.encountertable.application;

import java.util.List;
import java.util.Objects;
import src.domain.encountertable.model.catalog.model.EncounterTableSummaryData;
import src.domain.encountertable.model.catalog.port.EncounterTableCatalog;

public final class LoadEncounterTableSummariesUseCase {

    private final EncounterTableCatalog catalog;

    public LoadEncounterTableSummariesUseCase(EncounterTableCatalog catalog) {
        this.catalog = Objects.requireNonNull(catalog, "catalog");
    }

    public List<EncounterTableSummaryData> execute() {
        return catalog.loadSummaries();
    }
}
