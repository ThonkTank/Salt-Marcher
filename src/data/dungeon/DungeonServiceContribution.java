package src.data.dungeon;

import shell.api.ServiceContribution;
import shell.api.ServiceRegistry;
import src.data.dungeon.query.SqliteDungeonMapSearch;
import src.data.dungeon.repository.SqliteDungeonMapRepository;
import src.domain.dungeon.DungeonApplicationService;

public final class DungeonServiceContribution implements ServiceContribution {

    @SuppressWarnings({"PMD.UnnecessaryConstructor", "PMD.UncommentedEmptyConstructor"})
    public DungeonServiceContribution() {
    }

    @Override
    public void register(ServiceRegistry.Builder services) {
        SqliteDungeonMapRepository repository = new SqliteDungeonMapRepository();
        SqliteDungeonMapSearch search = new SqliteDungeonMapSearch();
        services.registerFactory(
                DungeonApplicationService.class,
                registry -> new DungeonApplicationService(repository, search));
    }
}
