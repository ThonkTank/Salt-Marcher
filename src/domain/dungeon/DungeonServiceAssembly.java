package src.domain.dungeon;

import shell.api.ServiceRegistry;

final class DungeonServiceAssembly {

    private final DungeonEditorPublishedStateServiceAssembly editorPublishedState =
            new DungeonEditorPublishedStateServiceAssembly();
    private final DungeonAuthoredPublishedStateServiceAssembly authoredPublishedState =
            new DungeonAuthoredPublishedStateServiceAssembly();
    private final DungeonEditorRuntimeServiceAssembly editorRuntime =
            new DungeonEditorRuntimeServiceAssembly(editorPublishedState);
    private final DungeonTravelApplicationServiceAssembly travelApplication =
            new DungeonTravelApplicationServiceAssembly();
    private final DungeonTravelRuntimeServiceAssembly travelRuntime = new DungeonTravelRuntimeServiceAssembly();

    void register(ServiceRegistry.Builder services) {
        services.registerFactory(
                DungeonTravelApplicationService.class,
                registry -> travelApplication.create(registry, authoredPublishedState));
        services.registerFactory(DungeonTravelRuntimeApplicationService.class, travelRuntime::service);
        authoredPublishedState.registerModels(services);
        services.registerFactory(src.domain.dungeon.published.TravelDungeonModel.class, travelRuntime::travelModel);
        services.registerFactory(
                DungeonEditorMapApplicationService.class,
                registry -> editorRuntime.mapService(registry, authoredPublishedState));
        services.registerFactory(
                DungeonEditorProjectionApplicationService.class,
                registry -> editorRuntime.projectionService(registry, authoredPublishedState));
        services.registerFactory(
                DungeonEditorPointerApplicationService.class,
                registry -> editorRuntime.pointerService(registry, authoredPublishedState));
        services.registerFactory(
                DungeonEditorNarrationApplicationService.class,
                registry -> editorRuntime.narrationService(registry, authoredPublishedState));
        editorPublishedState.registerModels(services);
    }
}
