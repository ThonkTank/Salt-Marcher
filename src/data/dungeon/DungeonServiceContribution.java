package src.data.dungeon;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.dungeon.query.SqliteDungeonMapSearch;
import src.data.dungeon.repository.DungeonPublishedStateRepositoryAdapter;
import src.data.dungeon.repository.SqliteDungeonMapRepository;
import src.domain.dungeon.DungeonAuthoredApplicationService;
import src.domain.dungeon.DungeonCatalogApplicationService;
import src.domain.dungeon.DungeonTravelApplicationService;
import src.domain.dungeon.published.DungeonAuthoredMutationModel;
import src.domain.dungeon.published.DungeonAuthoredReadModel;
import src.domain.dungeon.published.DungeonMapCatalogModel;
import src.domain.dungeon.published.DungeonTravelModel;

public final class DungeonServiceContribution implements ServiceContribution {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public DungeonServiceContribution() {
    }

    @Override
    public void register(ServiceRegistry.Builder services) {
        SqliteDungeonMapRepository repository = new SqliteDungeonMapRepository();
        SqliteDungeonMapSearch search = new SqliteDungeonMapSearch();
        DungeonPublishedStateRepositoryAdapter publishedState = new DungeonPublishedStateRepositoryAdapter();
        services.registerFactory(
                DungeonAuthoredApplicationService.class,
                registry -> new DungeonAuthoredApplicationService(repository, search, publishedState));
        services.registerFactory(
                DungeonCatalogApplicationService.class,
                registry -> new DungeonCatalogApplicationService(repository, search, publishedState));
        services.registerFactory(
                DungeonTravelApplicationService.class,
                registry -> new DungeonTravelApplicationService(repository, search, publishedState));
        services.register(DungeonAuthoredReadModel.class, publishedState.authoredReadModel);
        services.register(DungeonAuthoredMutationModel.class, publishedState.authoredMutationModel);
        services.register(DungeonMapCatalogModel.class, publishedState.mapCatalogModel);
        services.register(DungeonTravelModel.class, publishedState.travelModel);
    }
}
