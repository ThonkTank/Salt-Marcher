package src.domain.hex;

import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Function;
import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.domain.hex.model.map.repository.HexMapRepository;
import src.domain.hex.published.HexEditorModel;
import src.domain.hex.published.HexTravelModel;
import src.domain.party.published.PartyTravelPositionsModel;

public final class HexServiceContribution implements ServiceContribution {

    @Override
    public void register(ServiceRegistry.Builder services) {
        AtomicReference<HexServiceAssembly> assembly = new AtomicReference<>();
        Function<ServiceRegistry, HexServiceAssembly> resolver = registry -> resolveAssembly(assembly, registry);
        services.registerFactory(
                HexEditorApplicationService.class,
                registry -> resolver.apply(registry).editorApplicationService());
        services.registerFactory(
                HexEditorModel.class,
                registry -> resolver.apply(registry).editorModel());
        services.registerFactory(
                HexTravelApplicationService.class,
                registry -> resolver.apply(registry).travelApplicationService());
        services.registerFactory(
                HexTravelModel.class,
                registry -> resolver.apply(registry).travelModel());
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
                registry.require(src.domain.party.PartyApplicationService.class));
        return assembly.compareAndSet(null, candidate)
                ? candidate
                : Objects.requireNonNull(assembly.get(), "assembly");
    }
}
