package src.domain.hex;

import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Function;
import shell.api.ServiceRegistry;
import src.domain.hex.model.map.HexEditorWorkspace;
import src.domain.hex.model.map.repository.HexMapRepository;
import src.domain.hex.published.HexEditorModel;
import src.domain.hex.published.HexTravelModel;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.PartyTravelPositionsModel;

final class HexServiceAssembly {

    private final HexEditorApplicationService editorApplicationService;
    private final HexTravelApplicationService travelApplicationService;
    private final HexEditorModel editorModel = new HexEditorModel();
    private final HexTravelModel travelModel = new HexTravelModel();

    static void registerFactories(ServiceRegistry.Builder services) {
        AtomicReference<HexServiceAssembly> assembly = new AtomicReference<>();
        Function<ServiceRegistry, HexServiceAssembly> resolver = registry -> resolveAssembly(assembly, registry);
        services.registerFactory(
                HexEditorApplicationService.class,
                registry -> resolver.apply(registry).editorApplicationService);
        services.registerFactory(
                HexEditorModel.class,
                registry -> resolver.apply(registry).editorModel);
        services.registerFactory(
                HexTravelApplicationService.class,
                registry -> resolver.apply(registry).travelApplicationService);
        services.registerFactory(
                HexTravelModel.class,
                registry -> resolver.apply(registry).travelModel);
    }

    HexServiceAssembly(
            HexMapRepository repository,
            PartyTravelPositionsModel partyTravelPositions,
            PartyApplicationService partyApplicationService
    ) {
        HexMapRepository safeRepository = Objects.requireNonNull(repository, "repository");
        editorApplicationService = new HexEditorApplicationService(
                safeRepository,
                new HexEditorWorkspace(),
                editorModel);
        travelApplicationService = new HexTravelApplicationService(
                safeRepository,
                Objects.requireNonNull(partyApplicationService, "partyApplicationService"),
                travelModel);
        registerTravelReadback(Objects.requireNonNull(partyTravelPositions, "partyTravelPositions"));
    }

    private static HexServiceAssembly resolveAssembly(
            AtomicReference<HexServiceAssembly> assembly,
            ServiceRegistry registry
    ) {
        HexServiceAssembly existing = assembly.get();
        if (existing != null) {
            return existing;
        }
        HexServiceAssembly candidate = new HexServiceAssembly(
                registry.require(HexMapRepository.class),
                registry.require(PartyTravelPositionsModel.class),
                registry.require(PartyApplicationService.class));
        return assembly.compareAndSet(null, candidate)
                ? candidate
                : Objects.requireNonNull(assembly.get(), "assembly");
    }

    private void registerTravelReadback(PartyTravelPositionsModel partyTravelPositions) {
        travelApplicationService.acceptPartyTravelPosition(partyTravelPositions.current());
        partyTravelPositions.subscribe(travelApplicationService::acceptPartyTravelPosition);
    }
}
