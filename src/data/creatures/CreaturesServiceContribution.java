package src.data.creatures;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.creatures.repository.CreaturePublishedStateRepositoryAdapter;
import src.data.creatures.query.SqliteCreatureCatalogQueryAdapter;
import src.domain.creatures.CreaturesApplicationService;
import src.domain.creatures.catalog.port.CreatureCatalogLookup;
import src.domain.creatures.published.CreatureCatalogModel;
import src.domain.creatures.published.CreatureDetailModel;
import src.domain.creatures.published.CreatureFilterOptionsModel;

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
        CreatureCatalogLookup queryPort = new SqliteCreatureCatalogQueryAdapter();
        CreaturePublishedStateRepositoryAdapter publishedState = new CreaturePublishedStateRepositoryAdapter();
        CreaturesApplicationService applicationService = new CreaturesApplicationService(queryPort, publishedState);
        builder.register(
                CreaturesApplicationService.class,
                applicationService);
        builder.register(CreatureFilterOptionsModel.class, publishedState.filterOptionsModel);
        builder.register(CreatureCatalogModel.class, publishedState.catalogModel);
        builder.register(CreatureDetailModel.class, publishedState.detailModel);
    }
}
