package src.domain.dungeon;

import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;
import shell.api.ServiceRegistry;
import src.domain.dungeon.published.TravelDungeonModel;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.ActivePartyModel;
import src.domain.party.published.PartyMutationModel;
import src.domain.party.published.PartyTravelPositionsModel;

final class DungeonServiceAssembly {

    private final DungeonEditorPublishedState editorPublishedState = new DungeonEditorPublishedState();
    private final DungeonAuthoredPublishedState authoredPublishedState =
            new DungeonAuthoredPublishedState();
    private final AtomicReference<TravelRuntimeComponent> travelRuntime = new AtomicReference<>();

    void register(ServiceRegistry.Builder services) {
        services.registerFactory(DungeonAuthoredApplicationService.class, this::authoredApplicationService);
        services.registerFactory(DungeonEditorRuntimeApplicationService.class, this::editorRuntimeApplicationService);
        services.registerFactory(DungeonTravelRuntimeApplicationService.class,
                registry -> travelRuntime(registry).service());
        services.registerFactory(src.domain.dungeon.published.DungeonAuthoredReadModel.class,
                registry -> authoredPublishedState.authoredReadModel());
        services.registerFactory(src.domain.dungeon.published.DungeonAuthoredMutationModel.class,
                registry -> authoredPublishedState.authoredMutationModel());
        services.registerFactory(src.domain.dungeon.published.DungeonMapCatalogModel.class,
                registry -> authoredPublishedState.mapCatalogModel());
        services.registerFactory(TravelDungeonModel.class, registry -> travelRuntime(registry).travelModel());
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

    private TravelRuntimeComponent travelRuntime(ServiceRegistry registry) {
        TravelRuntimeComponent existing = travelRuntime.get();
        if (existing != null) {
            return existing;
        }
        ServiceRegistry services = Objects.requireNonNull(registry, "registry");
        DungeonAuthoredApplicationService authoredMaps =
                services.require(DungeonAuthoredApplicationService.class);
        DungeonTravelPartyGateway partyGateway = new DungeonTravelPartyGateway(
                services.require(ActivePartyModel.class),
                services.require(PartyTravelPositionsModel.class),
                services.require(PartyApplicationService.class),
                services.require(PartyMutationModel.class));
        DungeonTravelSurfaceLoader surfaceLoader =
                new DungeonTravelSurfaceLoader(authoredMaps, partyGateway);
        DungeonTravelNavigator navigator =
                new DungeonTravelNavigator(authoredMaps, partyGateway, surfaceLoader);
        DungeonTravelPublishedState publishedState = new DungeonTravelPublishedState();
        TravelRuntimeComponent candidate = new TravelRuntimeComponent(
                new DungeonTravelRuntimeApplicationService(surfaceLoader, navigator, publishedState),
                publishedState.travelModel());
        return travelRuntime.compareAndSet(null, candidate)
                ? candidate
                : Objects.requireNonNull(travelRuntime.get(), "travelRuntime");
    }

    private record TravelRuntimeComponent(
            DungeonTravelRuntimeApplicationService service,
            TravelDungeonModel travelModel
    ) {
    }
}
