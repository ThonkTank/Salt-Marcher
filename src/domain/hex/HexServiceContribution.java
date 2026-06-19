package src.domain.hex;

import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Function;
import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.domain.hex.model.map.repository.HexMapRepository;
import src.domain.hex.published.HexEditorModel;

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
    }

    private static HexServiceAssembly resolveAssembly(
            AtomicReference<HexServiceAssembly> assembly,
            ServiceRegistry registry
    ) {
        HexServiceAssembly existing = assembly.get();
        if (existing != null) {
            return existing;
        }
        HexServiceAssembly candidate = new HexServiceAssembly(registry.require(HexMapRepository.class));
        return assembly.compareAndSet(null, candidate)
                ? candidate
                : Objects.requireNonNull(assembly.get(), "assembly");
    }
}
