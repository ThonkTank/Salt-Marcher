package features.world.dungeon.runtime.task;

public final class NavigateToCellTask {

    private NavigateToCellTask() {
    }

    public static features.world.dungeon.runtime.input.NavigateToCellInput.NavigationInput navigateToCell(
            features.world.dungeon.runtime.input.NavigateToCellInput input
    ) throws java.sql.SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        if (input.mapId() <= 0) {
            throw new java.sql.SQLException("Kein aktiver Dungeon geladen");
        }
        try (java.sql.Connection conn = database.DatabaseManager.getConnection()) {
            features.world.dungeon.dungeonmap.repository.DungeonMapRepository mapRepository =
                    new features.world.dungeon.dungeonmap.repository.DungeonMapRepository();
            features.world.dungeon.dungeonmap.application.DungeonMapLoadResolver loadResolver =
                    new features.world.dungeon.dungeonmap.application.DungeonMapLoadResolver(mapRepository);
            features.world.dungeon.application.runtime.DungeonRuntimeApplicationService runtimeApplicationService =
                    runtimeApplicationService(mapRepository, loadResolver);
            var layout = loadResolver.resolveRepairLayout(conn, input.mapId());
            features.world.dungeon.application.runtime.DungeonRuntimeNavigationSnapshot snapshot = runtimeApplicationService.navigateToCell(
                    layout,
                    toNavigationSnapshot(input.currentNavigation()),
                    input.cell(),
                    input.levelZ());
            return toNavigationInput(snapshot);
        }
    }

    private static features.world.dungeon.application.runtime.DungeonRuntimeNavigationSnapshot toNavigationSnapshot(
            features.world.dungeon.runtime.input.NavigateToCellInput.NavigationInput input
    ) {
        if (input == null || input.isEmpty()) {
            return features.world.dungeon.application.runtime.DungeonRuntimeNavigationSnapshot.empty();
        }
        return new features.world.dungeon.application.runtime.DungeonRuntimeNavigationSnapshot(
                input.mapId(),
                input.cell(),
                input.levelZ(),
                heading(input.heading()));
    }

    private static features.world.dungeon.runtime.input.NavigateToCellInput.NavigationInput toNavigationInput(
            features.world.dungeon.application.runtime.DungeonRuntimeNavigationSnapshot snapshot
    ) {
        return snapshot == null || snapshot.isEmpty() || snapshot.cell() == null
                ? features.world.dungeon.runtime.input.NavigateToCellInput.NavigationInput.empty()
                : features.world.dungeon.runtime.input.NavigateToCellInput.NavigationInput.navigation(
                        snapshot.mapId(),
                        snapshot.cell(),
                        snapshot.levelZ(),
                        snapshot.heading() == null ? "" : snapshot.heading().name());
    }

    private static features.world.dungeon.application.runtime.DungeonRuntimeApplicationService runtimeApplicationService(
            features.world.dungeon.dungeonmap.repository.DungeonMapRepository mapRepository,
            features.world.dungeon.dungeonmap.application.DungeonMapLoadResolver loadResolver
    ) {
        return new features.world.dungeon.application.runtime.DungeonRuntimeApplicationService(mapRepository, loadResolver);
    }

    private static features.world.dungeon.geometry.CardinalDirection heading(String name) {
        return features.world.dungeon.geometry.CardinalDirection.parse(name);
    }
}
