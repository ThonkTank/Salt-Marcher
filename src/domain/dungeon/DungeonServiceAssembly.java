package src.domain.dungeon;

import shell.api.ServiceRegistry;

final class DungeonServiceAssembly {

    private final DungeonEditorPublishedState editorPublishedState = new DungeonEditorPublishedState();
    private final DungeonAuthoredPublishedState authoredPublishedState =
            new DungeonAuthoredPublishedState();
    private final DungeonTravelRuntimeServiceAssembly travelRuntime = new DungeonTravelRuntimeServiceAssembly();

    void register(ServiceRegistry.Builder services) {
        services.registerFactory(DungeonAuthoredApplicationService.class, this::authoredApplicationService);
        services.registerFactory(DungeonEditorRuntimeApplicationService.class, this::editorRuntimeApplicationService);
        services.registerFactory(DungeonTravelRuntimeApplicationService.class, travelRuntime::service);
        services.registerFactory(src.domain.dungeon.published.DungeonAuthoredReadModel.class,
                registry -> authoredPublishedState.authoredReadModel());
        services.registerFactory(src.domain.dungeon.published.DungeonAuthoredMutationModel.class,
                registry -> authoredPublishedState.authoredMutationModel());
        services.registerFactory(src.domain.dungeon.published.DungeonMapCatalogModel.class,
                registry -> authoredPublishedState.mapCatalogModel());
        services.registerFactory(src.domain.dungeon.published.TravelDungeonModel.class, travelRuntime::travelModel);
        services.registerFactory(src.domain.dungeon.published.DungeonEditorControlsModel.class,
                registry -> editorPublishedState.controlsModel());
        services.registerFactory(src.domain.dungeon.published.DungeonEditorMapSurfaceModel.class,
                registry -> editorPublishedState.mapSurfaceModel());
        services.registerFactory(src.domain.dungeon.published.DungeonEditorStateModel.class,
                registry -> editorPublishedState.stateModel());
    }

    private DungeonAuthoredApplicationService authoredApplicationService(ServiceRegistry registry) {
        return new DungeonAuthoredApplicationService(
                registry.require(src.domain.dungeon.model.core.repository.DungeonMapRepository.class),
                authoredPublishedState);
    }

    private DungeonEditorRuntimeApplicationService editorRuntimeApplicationService(ServiceRegistry registry) {
        return new DungeonEditorRuntimeApplicationService(
                registry.require(DungeonAuthoredApplicationService.class),
                editorPublishedState);
    }
}
