package src.data.dungeon;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;

public final class DungeonServiceContribution implements ServiceContribution {

    private final DungeonServiceAssembly assembly = new DungeonServiceAssembly();

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public DungeonServiceContribution() {
    }

    @Override
    public void register(ServiceRegistry.Builder services) {
        assembly.register(services);
    }
}
