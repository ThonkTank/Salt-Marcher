package src.data.dungeon;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;

public final class DungeonServiceContribution implements ServiceContribution {

    private final DungeonServiceAssembly assembly = new DungeonServiceAssembly();

    @Override
    public void register(ServiceRegistry.Builder services) {
        assembly.register(services);
    }
}
