package src.domain.hex;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;

public final class HexServiceContribution implements ServiceContribution {

    @Override
    public void register(ServiceRegistry.Builder services) {
        HexServiceAssembly.registerFactories(services);
    }
}
