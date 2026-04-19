package src.data.dungeon;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.domain.dungeon.DungeonApplicationService;

public final class DungeonServiceContribution implements ServiceContribution {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public DungeonServiceContribution() {
    }

    @Override
    public void register(ServiceRegistry.Builder services) {
        services.register(DungeonApplicationService.class, new DungeonApplicationService());
    }
}
