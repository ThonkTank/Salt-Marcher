package src.domain.encountertable.application;

import java.util.List;
import java.util.Objects;
import src.domain.encountertable.catalog.port.EncounterTableCatalog;
import src.domain.encountertable.published.EncounterTableSummary;

public final class LoadEncounterTableSummariesUseCase {

    private final EncounterTableCatalog catalog;

    public LoadEncounterTableSummariesUseCase(EncounterTableCatalog catalog) {
        this.catalog = Objects.requireNonNull(catalog, "catalog");
    }

    public List<EncounterTableSummary> execute() {
        return catalog.loadSummaries();
    }
}
