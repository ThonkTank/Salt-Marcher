package src.domain.dungeon;

import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;
import shell.api.ServiceRegistry;
import src.domain.dungeon.model.runtime.repository.TravelPartyPositionRepository;
import src.domain.dungeon.model.runtime.repository.TravelPartyStateRepository;

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
        DungeonAuthoredApplicationService authoredMaps =
                services.require(DungeonAuthoredApplicationService.class);
        src.domain.dungeon.model.runtime.usecase.LoadDungeonTravelSurfaceUseCase loadSurfaceUseCase =
                new src.domain.dungeon.model.runtime.usecase.LoadDungeonTravelSurfaceUseCase(
                        authoredMaps::loadMap,
                        authoredMaps::derive);
        src.domain.dungeon.model.runtime.usecase.MoveDungeonTravelActionUseCase moveActionUseCase =
                new src.domain.dungeon.model.runtime.usecase.MoveDungeonTravelActionUseCase(
                        authoredMaps::loadMap,
                        authoredMaps::findMap,
                        authoredMaps::derive);
        TravelPartyStateRepository partyStateRepository =
                new DungeonTravelPartyStateServiceAssembly().repository(services);
        TravelPartyPositionRepository partyPositionRepository =
                new DungeonTravelPartyPositionServiceAssembly().repository(services);
        DungeonTravelSurfaceLoader surfaceLoader =
                new DungeonTravelSurfaceLoader(
                        partyStateRepository,
                        partyPositionRepository,
                        loadSurfaceUseCase);
        src.domain.dungeon.model.runtime.usecase.ApplyTravelDungeonMovementUseCase applyMovementUseCase =
                new DungeonTravelNavigator(
                        partyStateRepository,
                        partyPositionRepository,
                        surfaceLoader,
                        moveActionUseCase).legacyMovementUseCase();
        src.domain.dungeon.model.runtime.usecase.StabilizeTravelDungeonProjectionUseCase stabilizeProjectionUseCase =
                new src.domain.dungeon.model.runtime.usecase.StabilizeTravelDungeonProjectionUseCase();
        src.domain.dungeon.model.runtime.usecase.ApplyTravelDungeonSessionUseCase applyUseCase =
                new src.domain.dungeon.model.runtime.usecase.ApplyTravelDungeonSessionUseCase(
                        surfaceLoader.legacySessionUseCase(),
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
