package src.data.creatures;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.creatures.gateway.local.SqliteCreatureCatalogLocalGateway;
import src.data.creatures.query.SqliteCreatureCatalogQueryAdapter;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.query.CreatureCatalogQueryPort;

/**
 * Root service entrypoint for the creatures feature.
 */
public final class CreaturesServiceContribution implements ServiceContribution {

    public CreaturesServiceContribution() {
    }

    @Override
    public void register(ServiceRegistry.Builder builder) {
        CreatureCatalogQueryPort queryPort =
                new SqliteCreatureCatalogQueryAdapter(new SqliteCreatureCatalogLocalGateway());
        CreaturesApplicationService applicationService = new CreaturesApplicationService(queryPort);
        builder.register(
                CreatureCatalogQueryPort.class,
                queryPort);
        builder.register(
                CreaturesApplicationService.class,
                applicationService);
        builder.register(
                CreaturesApplicationService.Factory.class,
                () -> applicationService);
    }
}
