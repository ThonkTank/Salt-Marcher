package src.data.encountertable;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.encountertable.query.SqliteEncounterTableCatalogAdapter;
import src.domain.encountertable.model.catalog.port.EncounterTableCatalogPort;

public final class EncounterTableServiceContribution implements ServiceContribution {

    @Override
    public void register(ServiceRegistry.Builder builder) {
        builder.register(EncounterTableCatalogPort.class, new SqliteEncounterTableCatalogAdapter());
    }
}
