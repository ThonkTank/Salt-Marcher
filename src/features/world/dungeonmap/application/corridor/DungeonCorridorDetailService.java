package features.world.dungeonmap.application.corridor;

import database.DatabaseManager;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.loading.DungeonMapLoadResult;
import features.world.dungeonmap.loading.DungeonMapLoader;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorDoorBinding;
import features.world.dungeonmap.model.structures.corridor.CorridorWaypointBinding;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Objects;

public final class DungeonCorridorDetailService {

    private final DungeonMapLoader mapLoader;
    private final DungeonCorridorPersistenceService corridorPersistenceService;

    public DungeonCorridorDetailService(
            DungeonMapLoader mapLoader,
            DungeonCorridorPersistenceService corridorPersistenceService
    ) {
        this.mapLoader = Objects.requireNonNull(mapLoader, "mapLoader");
        this.corridorPersistenceService = Objects.requireNonNull(corridorPersistenceService, "corridorPersistenceService");
    }

    public void moveDoorBinding(long mapId, long corridorId, long roomId, Point2i cell, Point2i direction) throws SQLException {
        DungeonLayout layout = requireLayout(mapId);
        Corridor corridor = requireCorridor(layout, corridorId);
        RoomCluster cluster = requireCluster(layout, roomId);
        Corridor updated = corridor.withDoorBinding(
                CorridorDoorBinding.atAbsoluteCell(roomId, cluster.clusterId(), cell, cluster.center(), direction));
        persistBindings(mapId, updated);
    }

    public void resetDoorBinding(long mapId, long corridorId, long roomId) throws SQLException {
        DungeonLayout layout = requireLayout(mapId);
        Corridor updated = requireCorridor(layout, corridorId).withoutDoorBinding(roomId);
        persistBindings(mapId, updated);
    }

    public void addWaypoint(long mapId, long corridorId, int index, long clusterId, Point2i cell) throws SQLException {
        DungeonLayout layout = requireLayout(mapId);
        RoomCluster cluster = layout.findCluster(clusterId);
        if (cluster == null) {
            throw new IllegalArgumentException("Unbekannter Cluster: " + clusterId);
        }
        Corridor updated = requireCorridor(layout, corridorId).withInsertedWaypoint(
                index,
                CorridorWaypointBinding.atAbsoluteCell(clusterId, cell, cluster.center(), 0));
        persistBindings(mapId, updated);
    }

    public void moveWaypoint(long mapId, long corridorId, int index, long clusterId, Point2i cell) throws SQLException {
        DungeonLayout layout = requireLayout(mapId);
        RoomCluster cluster = layout.findCluster(clusterId);
        if (cluster == null) {
            throw new IllegalArgumentException("Unbekannter Cluster: " + clusterId);
        }
        Corridor updated = requireCorridor(layout, corridorId).withMovedWaypoint(
                index,
                CorridorWaypointBinding.atAbsoluteCell(clusterId, cell, cluster.center(), 0));
        persistBindings(mapId, updated);
    }

    public void deleteWaypoint(long mapId, long corridorId, int index) throws SQLException {
        DungeonLayout layout = requireLayout(mapId);
        Corridor updated = requireCorridor(layout, corridorId).withRemovedWaypoint(index);
        persistBindings(mapId, updated);
    }

    private void persistBindings(long mapId, Corridor corridor) throws SQLException {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                corridorPersistenceService.persistCorridor(conn, corridor);
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

    private static Corridor requireCorridor(DungeonLayout layout, long corridorId) {
        Corridor corridor = layout.findCorridor(corridorId);
        if (corridor == null) {
            throw new IllegalArgumentException("Unbekannter Korridor: " + corridorId);
        }
        return corridor;
    }

    private static RoomCluster requireCluster(DungeonLayout layout, long roomId) {
        RoomCluster cluster = layout.clusterForRoom(roomId);
        if (cluster == null) {
            throw new IllegalArgumentException("Cluster für Raum fehlt: " + roomId);
        }
        return cluster;
    }
}
