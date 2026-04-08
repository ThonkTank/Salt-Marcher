package features.world.dungeon.runtime.task;

public final class NavigateTask {

    private NavigateTask() {
    }

    public static features.world.dungeon.runtime.input.NavigateInput.NavigationInput navigate(
            features.world.dungeon.runtime.input.NavigateInput input
    ) throws java.sql.SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        if (input.mapId() <= 0) {
            throw new java.sql.SQLException("Kein aktiver Dungeon geladen");
        }
        if (input.action() == null) {
            throw new java.sql.SQLException("Keine Aktion verfügbar");
        }
        try (java.sql.Connection conn = database.DatabaseManager.getConnection()) {
            features.world.dungeon.dungeonmap.repository.DungeonMapRepository mapRepository =
                    new features.world.dungeon.dungeonmap.repository.DungeonMapRepository();
            features.world.dungeon.dungeonmap.application.DungeonMapLoadResolver loadResolver =
                    new features.world.dungeon.dungeonmap.application.DungeonMapLoadResolver(mapRepository);
            features.world.dungeon.application.runtime.DungeonRuntimeApplicationService runtimeApplicationService =
                    runtimeApplicationService(mapRepository, loadResolver);
            var layout = loadResolver.resolveRepairLayout(conn, input.mapId());
            features.world.dungeon.application.runtime.DungeonRuntimeNavigationSnapshot snapshot = runtimeApplicationService.navigate(
                    layout,
                    toNavigationSnapshot(input.currentNavigation()),
                    toRuntimeAction(input.action()));
            return toNavigationInput(snapshot);
        }
    }

    private static features.world.dungeon.application.runtime.DungeonRuntimeNavigationSnapshot toNavigationSnapshot(
            features.world.dungeon.runtime.input.NavigateInput.NavigationInput input
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

    private static features.world.dungeon.application.runtime.DungeonRuntimeAction toRuntimeAction(
            features.world.dungeon.runtime.input.NavigateInput.ActionInput input
    ) {
        if (input.isCellAction()) {
            return runtimeAction(input, cellTarget(input));
        }
        if (input.isDoorAction()) {
            return runtimeAction(input, doorTarget(input));
        }
        if (input.isTransitionAction()) {
            return runtimeAction(input, transitionTarget(input));
        }
        throw new IllegalArgumentException("Unbekannte Runtime-Aktion: " + input.kind());
    }

    private static features.world.dungeon.application.runtime.DungeonRuntimeAction runtimeAction(
            features.world.dungeon.runtime.input.NavigateInput.ActionInput input,
            features.world.dungeon.application.runtime.DungeonRuntimeAction.Target target
    ) {
        return new features.world.dungeon.application.runtime.DungeonRuntimeAction(
                input.label(),
                "",
                input.failureMessage(),
                target);
    }

    private static features.world.dungeon.runtime.input.NavigateInput.NavigationInput toNavigationInput(
            features.world.dungeon.application.runtime.DungeonRuntimeNavigationSnapshot snapshot
    ) {
        return snapshot == null || snapshot.isEmpty() || snapshot.cell() == null
                ? features.world.dungeon.runtime.input.NavigateInput.NavigationInput.empty()
                : features.world.dungeon.runtime.input.NavigateInput.NavigationInput.navigation(
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

    private static features.world.dungeon.application.runtime.DungeonRuntimeAction.CellTarget cellTarget(
            features.world.dungeon.runtime.input.NavigateInput.ActionInput input
    ) {
        return new features.world.dungeon.application.runtime.DungeonRuntimeAction.CellTarget(
                input.requireCellTarget(),
                input.levelZ(),
                heading(input.resolvedHeadingOverride()));
    }

    private static features.world.dungeon.application.runtime.DungeonRuntimeAction.DoorTarget doorTarget(
            features.world.dungeon.runtime.input.NavigateInput.ActionInput input
    ) {
        return new features.world.dungeon.application.runtime.DungeonRuntimeAction.DoorTarget(
                new features.world.dungeon.dungeonmap.structure.model.boundary.door.DoorRef(
                        input.requireDoorTarget()));
    }

    private static features.world.dungeon.application.runtime.DungeonRuntimeAction.TransitionTarget transitionTarget(
            features.world.dungeon.runtime.input.NavigateInput.ActionInput input
    ) {
        return new features.world.dungeon.application.runtime.DungeonRuntimeAction.TransitionTarget(
                input.requireTransitionTarget());
    }
}
