package features.world.dungeon.runtime.task;

public final class RepairNavigationTask {

    private RepairNavigationTask() {
    }

    public static features.world.dungeon.runtime.input.RepairNavigationInput repairNavigation(
            features.world.dungeon.runtime.input.RepairNavigationInput input
    ) throws java.sql.SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        runtimeApplicationService().repairStoredRuntimeState(input.connection());
        return input;
    }

    private static features.world.dungeon.application.runtime.DungeonRuntimeApplicationService runtimeApplicationService() {
        features.world.dungeon.dungeonmap.repository.DungeonMapRepository mapRepository = mapRepository();
        features.world.dungeon.dungeonmap.application.DungeonMapLoadResolver loadResolver = loadResolver(mapRepository);
        return new features.world.dungeon.application.runtime.DungeonRuntimeApplicationService(mapRepository, loadResolver);
    }

    private static features.world.dungeon.dungeonmap.repository.DungeonMapRepository mapRepository() {
        return new features.world.dungeon.dungeonmap.repository.DungeonMapRepository();
    }

    private static features.world.dungeon.dungeonmap.application.DungeonMapLoadResolver loadResolver(
            features.world.dungeon.dungeonmap.repository.DungeonMapRepository mapRepository
    ) {
        return new features.world.dungeon.dungeonmap.application.DungeonMapLoadResolver(mapRepository);
    }
}
