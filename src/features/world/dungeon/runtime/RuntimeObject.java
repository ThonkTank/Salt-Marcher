package features.world.dungeon.runtime;

import database.DatabaseManager;
import features.world.dungeon.application.runtime.DungeonRuntimeApplicationService;
import features.world.dungeon.application.runtime.DungeonRuntimeNavigationSnapshot;
import features.world.dungeon.dungeonmap.application.DungeonMapLoadResolver;
import features.world.dungeon.geometry.CardinalDirection;
import features.world.dungeon.runtime.input.LoadNavigationInput;
import features.world.dungeon.runtime.input.NavigateToCellInput;
import features.world.dungeon.runtime.input.RepairNavigationInput;
import features.world.dungeon.runtime.input.ResolveNavigationInput;
import features.world.dungeon.runtime.input.ResolveRepairNavigationInput;

import java.sql.SQLException;
import java.util.Objects;

/**
 * Public root seam for dungeon runtime workflows.
 */
public final class RuntimeObject {

    private final DungeonMapLoadResolver loadResolver;
    private final DungeonRuntimeApplicationService runtimeApplicationService;

    public RuntimeObject(
            DungeonMapLoadResolver loadResolver,
            DungeonRuntimeApplicationService runtimeApplicationService
    ) {
        this.loadResolver = Objects.requireNonNull(loadResolver, "loadResolver");
        this.runtimeApplicationService = Objects.requireNonNull(runtimeApplicationService, "runtimeApplicationService");
    }

    public void repairNavigation(RepairNavigationInput input) throws SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        runtimeApplicationService.repairStoredRuntimeState(input.connection());
    }

    public ResolveRepairNavigationInput.NavigationInput resolveRepairNavigation(
            ResolveRepairNavigationInput input
    ) throws SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        try (java.sql.Connection conn = DatabaseManager.getConnection()) {
            var layout = loadResolver.resolveRepairLayout(conn, input.preferredMapId());
            DungeonRuntimeNavigationSnapshot snapshot = runtimeApplicationService.loadNavigation(layout);
            return toRepairNavigationInput(snapshot);
        }
    }

    public LoadNavigationInput.NavigationInput loadNavigation(LoadNavigationInput input) throws SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        if (input.mapId() <= 0) {
            return toLoadNavigationInput(null);
        }
        try (java.sql.Connection conn = DatabaseManager.getConnection()) {
            var layout = loadResolver.resolveRepairLayout(conn, input.mapId());
            DungeonRuntimeNavigationSnapshot snapshot = runtimeApplicationService.loadNavigation(layout);
            return toLoadNavigationInput(snapshot);
        } catch (RuntimeException exception) {
            throw new SQLException("Dungeon " + input.mapId() + " konnte nicht geladen werden", exception);
        }
    }

    public ResolveNavigationInput.NavigationInput resolveNavigation(
            ResolveNavigationInput input
    ) throws SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        try (java.sql.Connection conn = DatabaseManager.getConnection()) {
            var layout = loadResolver.resolveRepairLayout(conn, input.preferredMapId());
            DungeonRuntimeNavigationSnapshot snapshot = runtimeApplicationService.resolveNavigation(
                    layout,
                    input.preferredCell(),
                    input.preferredLevelZ(),
                    CardinalDirection.parse(input.preferredHeading()));
            return toResolveNavigationInput(snapshot);
        }
    }

    public NavigateToCellInput.NavigationInput navigateToCell(
            NavigateToCellInput input
    ) throws SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        if (input.mapId() <= 0) {
            throw new SQLException("Kein aktiver Dungeon geladen");
        }
        try (java.sql.Connection conn = DatabaseManager.getConnection()) {
            var layout = loadResolver.resolveRepairLayout(conn, input.mapId());
            DungeonRuntimeNavigationSnapshot snapshot = runtimeApplicationService.navigateToCell(
                    layout,
                    toNavigationSnapshot(input.currentNavigation()),
                    input.cell(),
                    input.levelZ());
            return toNavigateToCellInput(snapshot);
        }
    }

    private static ResolveRepairNavigationInput.NavigationInput toRepairNavigationInput(
            DungeonRuntimeNavigationSnapshot snapshot
    ) {
        if (snapshot == null || snapshot.isEmpty() || snapshot.cell() == null) {
            return new ResolveRepairNavigationInput.NavigationInput(null, null, 0, "");
        }
        return new ResolveRepairNavigationInput.NavigationInput(
                snapshot.mapId(),
                snapshot.cell(),
                snapshot.levelZ(),
                snapshot.heading() == null ? "" : snapshot.heading().name());
    }

    private static LoadNavigationInput.NavigationInput toLoadNavigationInput(
            DungeonRuntimeNavigationSnapshot snapshot
    ) {
        if (snapshot == null || snapshot.isEmpty() || snapshot.cell() == null) {
            return new LoadNavigationInput.NavigationInput(null, null, 0, "");
        }
        return new LoadNavigationInput.NavigationInput(
                snapshot.mapId(),
                snapshot.cell(),
                snapshot.levelZ(),
                snapshot.heading() == null ? "" : snapshot.heading().name());
    }

    private static ResolveNavigationInput.NavigationInput toResolveNavigationInput(
            DungeonRuntimeNavigationSnapshot snapshot
    ) {
        if (snapshot == null || snapshot.isEmpty() || snapshot.cell() == null) {
            return new ResolveNavigationInput.NavigationInput(null, null, 0, "");
        }
        return new ResolveNavigationInput.NavigationInput(
                snapshot.mapId(),
                snapshot.cell(),
                snapshot.levelZ(),
                snapshot.heading() == null ? "" : snapshot.heading().name());
    }

    private static NavigateToCellInput.NavigationInput toNavigateToCellInput(
            DungeonRuntimeNavigationSnapshot snapshot
    ) {
        if (snapshot == null || snapshot.isEmpty() || snapshot.cell() == null) {
            return new NavigateToCellInput.NavigationInput(null, null, 0, "");
        }
        return new NavigateToCellInput.NavigationInput(
                snapshot.mapId(),
                snapshot.cell(),
                snapshot.levelZ(),
                snapshot.heading() == null ? "" : snapshot.heading().name());
    }

    private static DungeonRuntimeNavigationSnapshot toNavigationSnapshot(
            NavigateToCellInput.NavigationInput input
    ) {
        if (input == null || input.mapId() == null || input.cell() == null) {
            return DungeonRuntimeNavigationSnapshot.empty();
        }
        return new DungeonRuntimeNavigationSnapshot(
                input.mapId(),
                input.cell(),
                input.levelZ(),
                CardinalDirection.parse(input.heading()));
    }
}
