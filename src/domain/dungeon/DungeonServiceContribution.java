package src.domain.dungeon;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;

public final class DungeonServiceContribution implements ServiceContribution {

    @Override
    public void register(ServiceRegistry.Builder services) {
        new DungeonServiceAssembly().register(services);
    }
}
