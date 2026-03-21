package features.world.dungeonmap.application.room;

import database.DatabaseManager;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.loading.DungeonMapLoadResult;
import features.world.dungeonmap.loading.DungeonMapLoader;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.TileShape;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Objects;

public final class DungeonRoomEditService {

    private final DungeonMapLoader mapLoader;
    private final RoomPaintTopologyPlanner planner;
    private final RoomTopologyEditPlanApplier planApplier;
    private final DungeonRoomTopologyService topologyService;

    public DungeonRoomEditService(
            DungeonMapLoader mapLoader,
            RoomPaintTopologyPlanner planner,
            RoomTopologyEditPlanApplier planApplier,
            DungeonRoomTopologyService topologyService
    ) {
        this.mapLoader = Objects.requireNonNull(mapLoader, "mapLoader");
        this.planner = Objects.requireNonNull(planner, "planner");
        this.planApplier = Objects.requireNonNull(planApplier, "planApplier");
        this.topologyService = Objects.requireNonNull(topologyService, "topologyService");
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
            try (Connection conn = DatabaseManager.getConnection()) {
                DungeonTransactionRunner.inTransaction(conn, () -> {
                    if (legacyPlan.deleteMode()) {
                        topologyService.delete(conn, mapId, legacyPlan.shape());
                    } else {
                        topologyService.paint(conn, mapId, legacyPlan.shape());
                    }
                });
            }
            return;
        }
        if (plan instanceof NoOpRoomEditPlan) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                planApplier.apply(conn, layout, plan);
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
