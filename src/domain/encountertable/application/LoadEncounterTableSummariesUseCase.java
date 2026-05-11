package src.domain.encountertable.application;

import java.util.List;
import java.util.Objects;
import src.domain.encountertable.model.catalog.model.EncounterTableSummaryData;
import src.domain.encountertable.model.catalog.repository.EncounterTableCatalogRepository;

public final class LoadEncounterTableSummariesUseCase {

    private final EncounterTableCatalogRepository catalog;

    public LoadEncounterTableSummariesUseCase(EncounterTableCatalogRepository catalog) {
        this.catalog = Objects.requireNonNull(catalog, "catalog");
    }

    public List<EncounterTableSummaryData> execute() {
        return catalog.loadSummaries();
    }
}
