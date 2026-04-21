package src.data.encountertable;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.encountertable.query.SqliteEncounterTableCatalogAdapter;
import src.domain.encountertable.EncounterTableApplicationService;
import src.domain.encountertable.catalog.port.EncounterTableCatalog;

public final class EncounterTableServiceContribution implements ServiceContribution {

    @SuppressWarnings("PMD.UnnecessaryConstructor")
    public EncounterTableServiceContribution() {
        // Required by passive service contribution discovery.
    }

    @Override
    public void register(ServiceRegistry.Builder builder) {
        EncounterTableCatalog catalog = new SqliteEncounterTableCatalogAdapter();
        builder.register(
                EncounterTableApplicationService.class,
                new EncounterTableApplicationService(catalog));
    }
}
