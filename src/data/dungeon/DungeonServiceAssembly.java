package src.data.dungeon;

import shell.api.ServiceRegistry;
import src.data.dungeon.repository.SqliteDungeonMapRepository;
import src.domain.dungeon.model.core.repository.DungeonMapRepository;

final class DungeonServiceAssembly {

    void register(ServiceRegistry.Builder services) {
        services.register(DungeonMapRepository.class, new SqliteDungeonMapRepository());
    }
}
