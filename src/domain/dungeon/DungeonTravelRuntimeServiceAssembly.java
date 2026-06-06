package src.domain.dungeon;

import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;
import shell.api.ServiceRegistry;

final class DungeonTravelRuntimeServiceAssembly {

    private final AtomicReference<TravelRuntimeComponent> travelRuntime = new AtomicReference<>();

    DungeonTravelRuntimeApplicationService service(ServiceRegistry registry) {
        return component(registry).service();
    }

    src.domain.dungeon.published.TravelDungeonModel travelModel(ServiceRegistry registry) {
        return component(registry).travelModel();
    }

    private TravelRuntimeComponent component(ServiceRegistry registry) {
        TravelRuntimeComponent existing = travelRuntime.get();
        if (existing != null) {
            return existing;
        }
        ServiceRegistry services = requireRegistry(registry);
        src.domain.dungeon.model.core.repository.DungeonMapRepository dungeonMapRepository =
                services.require(src.domain.dungeon.model.core.repository.DungeonMapRepository.class);
        src.domain.dungeon.model.worldspace.usecase.LoadDungeonMapUseCase loadDungeonMapUseCase =
                new src.domain.dungeon.model.worldspace.usecase.LoadDungeonMapUseCase(dungeonMapRepository);
        src.domain.dungeon.model.worldspace.usecase.BuildDungeonDerivedStateUseCase derive =
                new src.domain.dungeon.model.worldspace.usecase.BuildDungeonDerivedStateUseCase();
        src.domain.dungeon.model.runtime.usecase.LoadDungeonTravelSurfaceUseCase loadSurfaceUseCase =
                new src.domain.dungeon.model.runtime.usecase.LoadDungeonTravelSurfaceUseCase(
                        loadDungeonMapUseCase,
                        derive);
        src.domain.dungeon.model.runtime.usecase.MoveDungeonTravelActionUseCase moveActionUseCase =
                new src.domain.dungeon.model.runtime.usecase.MoveDungeonTravelActionUseCase(
                        loadDungeonMapUseCase,
                        dungeonMapRepository,
                        derive);
        src.domain.dungeon.model.runtime.repository.TravelPartyStateRepository partyStateRepository =
                services.require(src.domain.dungeon.model.runtime.repository.TravelPartyStateRepository.class);
        src.domain.dungeon.model.runtime.repository.TravelPartyPositionRepository partyPositionRepository =
                services.require(src.domain.dungeon.model.runtime.repository.TravelPartyPositionRepository.class);
        src.domain.dungeon.model.runtime.usecase.LoadTravelDungeonSessionSurfaceUseCase loadSessionSurfaceUseCase =
                new src.domain.dungeon.model.runtime.usecase.LoadTravelDungeonSessionSurfaceUseCase(
                        partyStateRepository,
                        partyPositionRepository,
                        loadSurfaceUseCase);
        src.domain.dungeon.model.runtime.usecase.ApplyTravelDungeonMovementUseCase applyMovementUseCase =
                new src.domain.dungeon.model.runtime.usecase.ApplyTravelDungeonMovementUseCase(
                        partyStateRepository,
                        partyPositionRepository,
                        loadSurfaceUseCase,
                        moveActionUseCase);
        src.domain.dungeon.model.runtime.usecase.StabilizeTravelDungeonProjectionUseCase stabilizeProjectionUseCase =
                new src.domain.dungeon.model.runtime.usecase.StabilizeTravelDungeonProjectionUseCase();
        src.domain.dungeon.model.runtime.usecase.ApplyTravelDungeonSessionUseCase applyUseCase =
                new src.domain.dungeon.model.runtime.usecase.ApplyTravelDungeonSessionUseCase(
                        loadSessionSurfaceUseCase,
                        applyMovementUseCase,
                        stabilizeProjectionUseCase);
        DungeonTravelRuntimePublishedStateServiceAssembly publishedState =
                new DungeonTravelRuntimePublishedStateServiceAssembly();
        src.domain.dungeon.model.runtime.usecase.PublishTravelDungeonSessionUseCase publishUseCase =
                new src.domain.dungeon.model.runtime.usecase.PublishTravelDungeonSessionUseCase(applyUseCase, publishedState);
        TravelRuntimeComponent candidate = new TravelRuntimeComponent(
                new DungeonTravelRuntimeApplicationService(publishUseCase),
                publishedState.travelModel());
        return travelRuntime.compareAndSet(null, candidate)
                ? candidate
                : Objects.requireNonNull(travelRuntime.get(), "travelRuntime");
    }

    private static ServiceRegistry requireRegistry(ServiceRegistry registry) {
        return Objects.requireNonNull(registry, "registry");
    }

    private record TravelRuntimeComponent(
            DungeonTravelRuntimeApplicationService service,
            src.domain.dungeon.published.TravelDungeonModel travelModel
    ) {
    }
}
