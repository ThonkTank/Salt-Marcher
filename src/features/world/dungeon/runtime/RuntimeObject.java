package features.world.dungeon.runtime;

import database.DatabaseManager;
import features.world.dungeon.application.runtime.DungeonRuntimeApplicationService;
import features.world.dungeon.application.runtime.DungeonRuntimeNavigationSnapshot;
import features.world.dungeon.dungeonmap.application.DungeonMapLoadResolver;
import features.world.dungeon.runtime.input.RepairNavigationInput;
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
            return toNavigationInput(snapshot);
        }
    }

    private static ResolveRepairNavigationInput.NavigationInput toNavigationInput(
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
}
