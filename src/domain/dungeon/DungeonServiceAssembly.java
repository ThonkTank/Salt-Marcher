package src.domain.dungeon;

import shell.api.ServiceRegistry;

final class DungeonServiceAssembly {

    private final DungeonEditorPublishedStateServiceAssembly editorPublishedState =
            new DungeonEditorPublishedStateServiceAssembly();
    private final DungeonAuthoredPublishedStateServiceAssembly authoredPublishedState =
            new DungeonAuthoredPublishedStateServiceAssembly();
    private final DungeonTravelRuntimeServiceAssembly travelRuntime = new DungeonTravelRuntimeServiceAssembly();

    void register(ServiceRegistry.Builder services) {
        services.registerFactory(DungeonTravelRuntimeApplicationService.class, travelRuntime::service);
        authoredPublishedState.registerModels(services);
        services.registerFactory(src.domain.dungeon.published.TravelDungeonModel.class, travelRuntime::travelModel);
        editorPublishedState.registerModels(services);
    }
}
