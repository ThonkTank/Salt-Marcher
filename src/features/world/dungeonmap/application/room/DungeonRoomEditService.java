package features.world.dungeonmap.application.room;

import database.DatabaseManager;
import features.world.dungeonmap.loading.DungeonMapLoadResult;
import features.world.dungeonmap.loading.DungeonMapLoader;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.quarantine.dungeonmap.foundation.db.DungeonTransactionSupport;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Objects;

public final class DungeonRoomEditService {

    private final DungeonMapLoader mapLoader;
    private final RoomPaintTopologyPlanner planner;
    private final RoomTopologyEditPlanApplier planApplier;
    private final LegacyRoomTopologyBridge legacyBridge;

    public DungeonRoomEditService(
            DungeonMapLoader mapLoader,
            RoomPaintTopologyPlanner planner,
            RoomTopologyEditPlanApplier planApplier,
            LegacyRoomTopologyBridge legacyBridge
    ) {
        this.mapLoader = Objects.requireNonNull(mapLoader, "mapLoader");
        this.planner = Objects.requireNonNull(planner, "planner");
        this.planApplier = Objects.requireNonNull(planApplier, "planApplier");
        this.legacyBridge = Objects.requireNonNull(legacyBridge, "legacyBridge");
    }

    public void paint(long mapId, TileShape shape) throws SQLException {
        execute(mapId, shape, false);
    }

    public void delete(long mapId, TileShape shape) throws SQLException {
        execute(mapId, shape, true);
    }

    private void execute(long mapId, TileShape shape, boolean deleteMode) throws SQLException {
        if (shape == null || shape.size() == 0) {
            return;
        }
        DungeonLayout layout = requireLayout(mapId);
        RoomTopologyEditPlan plan = deleteMode ? planner.planDelete(layout, shape) : planner.planPaint(layout, shape);
        if (plan instanceof LegacyBridgeRoomEditPlan legacyPlan) {
            if (legacyPlan.deleteMode()) {
                legacyBridge.delete(mapId, legacyPlan.shape());
            } else {
                legacyBridge.paint(mapId, legacyPlan.shape());
            }
            return;
        }
        if (plan instanceof NoOpRoomEditPlan) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionSupport.inTransaction(conn, () -> {
                planApplier.apply(conn, plan);
                return null;
            });
        }
    }

    private DungeonLayout requireLayout(long mapId) throws SQLException {
        DungeonMapLoadResult loadResult = mapLoader.loadMap(mapId, List.of());
        if (loadResult.activeMap() == null) {
            throw new SQLException("Dungeon " + mapId + " konnte nicht geladen werden");
        }
        return loadResult.activeMap();
    }
}
