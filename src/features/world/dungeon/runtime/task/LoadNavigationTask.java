package features.world.dungeon.runtime.task;

public final class LoadNavigationTask {

    private LoadNavigationTask() {
    }

    public static features.world.dungeon.runtime.input.LoadNavigationInput.NavigationInput loadNavigation(
            features.world.dungeon.runtime.input.LoadNavigationInput input
    ) throws java.sql.SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        if (input.mapId() <= 0) {
            return features.world.dungeon.runtime.input.LoadNavigationInput.NavigationInput.empty();
        }
        try (java.sql.Connection conn = database.DatabaseManager.getConnection()) {
            features.world.dungeon.dungeonmap.repository.DungeonMapRepository mapRepository =
                    new features.world.dungeon.dungeonmap.repository.DungeonMapRepository();
            features.world.dungeon.dungeonmap.application.DungeonMapLoadResolver loadResolver =
                    new features.world.dungeon.dungeonmap.application.DungeonMapLoadResolver(mapRepository);
            features.world.dungeon.application.runtime.DungeonRuntimeApplicationService runtimeApplicationService =
                    runtimeApplicationService(mapRepository, loadResolver);
            var layout = loadResolver.resolveRepairLayout(conn, input.mapId());
            features.world.dungeon.application.runtime.DungeonRuntimeNavigationSnapshot snapshot =
                    runtimeApplicationService.loadNavigation(layout);
            return toNavigationInput(snapshot);
        } catch (RuntimeException exception) {
            throw new java.sql.SQLException("Dungeon " + input.mapId() + " konnte nicht geladen werden", exception);
        }
    }

    private static features.world.dungeon.runtime.input.LoadNavigationInput.NavigationInput toNavigationInput(
            features.world.dungeon.application.runtime.DungeonRuntimeNavigationSnapshot snapshot
    ) {
        return snapshot == null || snapshot.isEmpty() || snapshot.cell() == null
                ? features.world.dungeon.runtime.input.LoadNavigationInput.NavigationInput.empty()
                : features.world.dungeon.runtime.input.LoadNavigationInput.NavigationInput.navigation(
                        snapshot.mapId(),
                        snapshot.cell(),
                        snapshot.levelZ(),
                        headingName(snapshot));
    }

    private static features.world.dungeon.application.runtime.DungeonRuntimeApplicationService runtimeApplicationService(
            features.world.dungeon.dungeonmap.repository.DungeonMapRepository mapRepository,
            features.world.dungeon.dungeonmap.application.DungeonMapLoadResolver loadResolver
    ) {
        return new features.world.dungeon.application.runtime.DungeonRuntimeApplicationService(mapRepository, loadResolver);
    }

    private static String headingName(
            features.world.dungeon.application.runtime.DungeonRuntimeNavigationSnapshot snapshot
    ) {
        return snapshot.heading() == null ? "" : snapshot.heading().name();
    }
}
