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
        src.domain.dungeon.model.worldspace.usecase.ApplyTravelDungeonSessionUseCase applyUseCase =
                new src.domain.dungeon.model.worldspace.usecase.ApplyTravelDungeonSessionUseCase(
                        services.require(src.domain.dungeon.model.worldspace.repository.TravelDungeonSessionRepository.class));
        DungeonTravelRuntimePublishedStateServiceAssembly publishedState =
                new DungeonTravelRuntimePublishedStateServiceAssembly();
        publishedState.publishCurrentSession(applyUseCase.snapshot());
        src.domain.dungeon.model.worldspace.usecase.PublishTravelDungeonSessionUseCase publishUseCase =
                new src.domain.dungeon.model.worldspace.usecase.PublishTravelDungeonSessionUseCase(applyUseCase, publishedState);
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
