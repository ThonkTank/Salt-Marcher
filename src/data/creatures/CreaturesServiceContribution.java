package src.data.creatures;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.creatures.query.SqliteCreatureCatalogQueryAdapter;
import src.domain.creatures.model.catalog.port.CreatureCatalogPort;

/**
 * Source-adapter service entrypoint for the creatures feature.
 */
public final class CreaturesServiceContribution implements ServiceContribution {

    @Override
    public void register(ServiceRegistry.Builder builder) {
        builder.register(CreatureCatalogPort.class, new SqliteCreatureCatalogQueryAdapter());
    }
}
