package features.world.dungeon.runtime.task;

public final class ResolveNavigationTask {

    private ResolveNavigationTask() {
    }

    public static features.world.dungeon.runtime.input.ResolveNavigationInput.NavigationInput resolveNavigation(
            features.world.dungeon.runtime.input.ResolveNavigationInput input
    ) throws java.sql.SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        try (java.sql.Connection conn = database.DatabaseManager.getConnection()) {
            features.world.dungeon.dungeonmap.repository.DungeonMapRepository mapRepository =
                    new features.world.dungeon.dungeonmap.repository.DungeonMapRepository();
            features.world.dungeon.dungeonmap.application.DungeonMapLoadResolver loadResolver =
                    new features.world.dungeon.dungeonmap.application.DungeonMapLoadResolver(mapRepository);
            features.world.dungeon.application.runtime.DungeonRuntimeApplicationService runtimeApplicationService =
                    new features.world.dungeon.application.runtime.DungeonRuntimeApplicationService(mapRepository, loadResolver);
            var layout = loadResolver.resolveRepairLayout(conn, input.preferredMapId());
            features.world.dungeon.application.runtime.DungeonRuntimeNavigationSnapshot snapshot = runtimeApplicationService.resolveNavigation(
                    layout,
                    input.preferredCell(),
                    input.preferredLevelZ(),
                    features.world.dungeon.geometry.CardinalDirection.parse(input.preferredHeading()));
            return toNavigationInput(snapshot);
        }
    }

    private static features.world.dungeon.runtime.input.ResolveNavigationInput.NavigationInput toNavigationInput(
            features.world.dungeon.application.runtime.DungeonRuntimeNavigationSnapshot snapshot
    ) {
        return snapshot == null || snapshot.isEmpty() || snapshot.cell() == null
                ? features.world.dungeon.runtime.input.ResolveNavigationInput.NavigationInput.empty()
                : features.world.dungeon.runtime.input.ResolveNavigationInput.NavigationInput.navigation(
                        snapshot.mapId(),
                        snapshot.cell(),
                        snapshot.levelZ(),
                        snapshot.heading() == null ? "" : snapshot.heading().name());
    }
}
