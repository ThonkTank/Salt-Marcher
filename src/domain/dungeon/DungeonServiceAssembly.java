package src.domain.dungeon;

import shell.api.ServiceRegistry;

final class DungeonServiceAssembly {

    private final DungeonEditorPublishedStateServiceAssembly editorPublishedState =
            new DungeonEditorPublishedStateServiceAssembly();
    private final DungeonAuthoredPublishedState authoredPublishedState =
            new DungeonAuthoredPublishedState();
    private final DungeonTravelRuntimeServiceAssembly travelRuntime = new DungeonTravelRuntimeServiceAssembly();

    void register(ServiceRegistry.Builder services) {
        services.registerFactory(DungeonAuthoredApplicationService.class, this::authoredApplicationService);
        services.registerFactory(DungeonTravelRuntimeApplicationService.class, travelRuntime::service);
        authoredPublishedState.registerModels(services);
        services.registerFactory(src.domain.dungeon.published.TravelDungeonModel.class, travelRuntime::travelModel);
        editorPublishedState.registerModels(services);
    }

    private DungeonAuthoredApplicationService authoredApplicationService(ServiceRegistry registry) {
        return new DungeonAuthoredApplicationService(
                registry.require(src.domain.dungeon.model.core.repository.DungeonMapRepository.class),
                authoredPublishedState);
    }
}
