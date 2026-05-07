package src.data.encountertable;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.encountertable.query.SqliteEncounterTableCatalogAdapter;
import src.domain.encountertable.EncounterTableApplicationService;
import src.domain.encountertable.catalog.port.EncounterTableCatalog;
import src.domain.encountertable.published.EncounterTableCatalogModel;
import src.domain.encountertable.published.LoadEncounterTableSummariesQuery;

public final class EncounterTableServiceContribution implements ServiceContribution {

    @SuppressWarnings("PMD.UnnecessaryConstructor")
    public EncounterTableServiceContribution() {
        // Required by passive service contribution discovery.
    }

    @Override
    public void register(ServiceRegistry.Builder builder) {
        EncounterTableCatalog catalog = new SqliteEncounterTableCatalogAdapter();
        EncounterTableApplicationService applicationService = new EncounterTableApplicationService(catalog);
        builder.register(
                EncounterTableApplicationService.class,
                applicationService);
        builder.register(
                EncounterTableCatalogModel.class,
                applicationService.loadCatalogModel(new LoadEncounterTableSummariesQuery()));
    }
}
