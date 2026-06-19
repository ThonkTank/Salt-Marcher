package src.data.hex;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;

public final class HexServiceContribution implements ServiceContribution {

    private final HexServiceAssembly assembly = new HexServiceAssembly();

    @Override
    public void register(ServiceRegistry.Builder builder) {
        assembly.register(builder);
    }
}
