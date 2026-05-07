package src.data.creatures;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.creatures.query.SqliteCreatureCatalogQueryAdapter;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.catalog.port.CreatureCatalogLookup;
import src.domain.creatures.published.CreatureCatalogModel;
import src.domain.creatures.published.CreatureCatalogQuery;
import src.domain.creatures.published.CreatureFilterOptionsModel;
import src.domain.creatures.published.LoadCreatureFilterOptionsQuery;

/**
 * Root service entrypoint for the creatures feature.
 */
public final class CreaturesServiceContribution implements ServiceContribution {

    @SuppressWarnings("PMD.UnnecessaryConstructor")
    public CreaturesServiceContribution() {
        // Required by passive service contribution discovery.
    }

    @Override
    public void register(ServiceRegistry.Builder builder) {
        CreatureCatalogLookup queryPort =
                new SqliteCreatureCatalogQueryAdapter();
        CreaturesApplicationService applicationService = new CreaturesApplicationService(queryPort);
        builder.register(
                CreaturesApplicationService.class,
                applicationService);
        builder.register(
                CreatureFilterOptionsModel.class,
                applicationService.loadFilterOptionsModel(new LoadCreatureFilterOptionsQuery()));
        builder.register(
                CreatureCatalogModel.class,
                applicationService.loadCatalogModel(CreatureCatalogQuery.defaults()));
    }
}
