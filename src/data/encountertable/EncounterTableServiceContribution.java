package src.data.encountertable;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.encountertable.repository.EncounterTablePublishedStateRepositoryAdapter;
import src.data.encountertable.query.SqliteEncounterTableCatalogAdapter;
import src.domain.encountertable.EncounterTableApplicationService;
import src.domain.encountertable.model.catalog.port.EncounterTableCatalog;
import src.domain.encountertable.published.EncounterTableCatalogModel;

public final class EncounterTableServiceContribution implements ServiceContribution {

    @SuppressWarnings("PMD.UnnecessaryConstructor")
    public EncounterTableServiceContribution() {
        // Required by passive service contribution discovery.
    }

    @Override
    public void register(ServiceRegistry.Builder builder) {
        EncounterTableCatalog catalog = new SqliteEncounterTableCatalogAdapter();
        EncounterTablePublishedStateRepositoryAdapter publishedState = new EncounterTablePublishedStateRepositoryAdapter();
        EncounterTableApplicationService applicationService = new EncounterTableApplicationService(catalog, publishedState);
        builder.register(
                EncounterTableApplicationService.class,
                applicationService);
        builder.register(EncounterTableCatalogModel.class, publishedState.catalogModel);
    }
}
