package src.domain.dungeon;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.domain.dungeon.published.DungeonAuthoredMutationModel;
import src.domain.dungeon.published.DungeonAuthoredReadModel;
import src.domain.dungeon.published.DungeonEditorControlsModel;
import src.domain.dungeon.published.DungeonEditorMapSurfaceModel;
import src.domain.dungeon.published.DungeonEditorStateModel;
import src.domain.dungeon.published.DungeonMapCatalogModel;
import src.domain.dungeon.published.DungeonTravelModel;
import src.domain.dungeon.published.TravelDungeonModel;

public final class DungeonServiceContribution implements ServiceContribution {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public DungeonServiceContribution() {
    }

    @Override
    public void register(ServiceRegistry.Builder services) {
        DungeonServiceAssembly assembly = new DungeonServiceAssembly();
        services.registerFactory(DungeonAuthoredApplicationService.class, assembly::createAuthoredApplicationService);
        services.registerFactory(DungeonCatalogApplicationService.class, assembly::createCatalogApplicationService);
        services.registerFactory(DungeonTravelApplicationService.class, assembly::createTravelApplicationService);
        services.registerFactory(DungeonTravelRuntimeApplicationService.class, assembly::createTravelRuntimeApplicationService);
        services.registerFactory(DungeonAuthoredReadModel.class, assembly::authoredReadModel);
        services.registerFactory(DungeonAuthoredMutationModel.class, assembly::authoredMutationModel);
        services.registerFactory(DungeonMapCatalogModel.class, assembly::mapCatalogModel);
        services.registerFactory(DungeonTravelModel.class, assembly::dungeonTravelModel);
        services.registerFactory(TravelDungeonModel.class, assembly::travelDungeonModel);
        services.registerFactory(DungeonEditorApplicationService.class, assembly::createEditorApplicationService);
        services.registerFactory(DungeonEditorControlsModel.class, assembly::createControlsModel);
        services.registerFactory(DungeonEditorMapSurfaceModel.class, assembly::createMapSurfaceModel);
        services.registerFactory(DungeonEditorStateModel.class, assembly::createStateModel);
    }
}
