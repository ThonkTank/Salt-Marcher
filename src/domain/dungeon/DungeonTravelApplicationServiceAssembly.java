package src.domain.dungeon;

import shell.api.ServiceRegistry;

final class DungeonTravelApplicationServiceAssembly {

    DungeonTravelApplicationService create(
            ServiceRegistry registry,
            DungeonAuthoredPublishedStateServiceAssembly publishedState
    ) {
        src.domain.dungeon.model.worldspace.usecase.LoadDungeonMapUseCase loadDungeonMapUseCase =
                loadDungeonMapUseCase(registry);
        src.domain.dungeon.model.worldspace.usecase.BuildDungeonDerivedStateUseCase derive =
                new src.domain.dungeon.model.worldspace.usecase.BuildDungeonDerivedStateUseCase();
        return new DungeonTravelApplicationService(
                new src.domain.dungeon.model.worldspace.usecase.PublishDungeonTravelSurfaceUseCase(
                        new src.domain.dungeon.model.worldspace.usecase.LoadDungeonTravelSurfaceUseCase(
                                loadDungeonMapUseCase,
                                derive),
                        publishedState),
                new src.domain.dungeon.model.worldspace.usecase.PublishDungeonTravelMoveUseCase(
                        new src.domain.dungeon.model.worldspace.usecase.MoveDungeonTravelActionUseCase(
                                loadDungeonMapUseCase,
                                registry.require(src.domain.dungeon.model.worldspace.repository.DungeonMapRepository.class),
                                derive),
                        publishedState));
    }

    private static src.domain.dungeon.model.worldspace.usecase.LoadDungeonMapUseCase loadDungeonMapUseCase(
            ServiceRegistry registry
    ) {
        return new src.domain.dungeon.model.worldspace.usecase.LoadDungeonMapUseCase(
                registry.require(src.domain.dungeon.model.worldspace.repository.DungeonMapRepository.class));
    }
}
