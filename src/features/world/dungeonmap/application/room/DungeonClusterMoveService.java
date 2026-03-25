package features.world.dungeonmap.application.room;

import database.DatabaseManager;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.loading.DungeonMapLoader;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.persistence.DungeonRoomGeometryWriteMapper;
import features.world.dungeonmap.persistence.DungeonRoomWriteRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

public final class DungeonClusterMoveService {

    private final DungeonMapLoader mapLoader;
    private final DungeonRoomWriteRepository roomWriteRepository;
    private final DungeonRoomGeometryWriteMapper geometryWriteMapper;

    public DungeonClusterMoveService(
            DungeonMapLoader mapLoader,
            DungeonRoomWriteRepository roomWriteRepository,
            DungeonRoomGeometryWriteMapper geometryWriteMapper
    ) {
        this.mapLoader = Objects.requireNonNull(mapLoader, "mapLoader");
        this.roomWriteRepository = Objects.requireNonNull(roomWriteRepository, "roomWriteRepository");
        this.geometryWriteMapper = Objects.requireNonNull(geometryWriteMapper, "geometryWriteMapper");
    }

    public void move(long mapId, long clusterId, Point2i delta) throws SQLException {
        move(mapId, clusterId, delta, 0);
    }

    public void move(long mapId, long clusterId, Point2i delta, int levelDelta) throws SQLException {
        boolean translate = delta != null && (delta.x() != 0 || delta.y() != 0);
        if (!translate && levelDelta == 0) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                RoomCluster cluster = requireMovedCluster(conn, mapId, clusterId, delta, levelDelta);
                roomWriteRepository.updateClusterGeometry(
                        conn,
                        clusterId,
                        geometryWriteMapper.toClusterGeometry(shapesByLevel(cluster)),
                        primaryLevel(cluster));
                for (Room room : cluster.rooms()) {
                    if (room == null || room.roomId() == null) {
                        continue;
                    }
                    roomWriteRepository.updateRoomPosition(conn, room.roomId(), room.anchorsByLevel(), room.primaryLevel());
                }
            });
        }
    }

    private RoomCluster requireMovedCluster(Connection conn, long mapId, long clusterId, Point2i delta, int levelDelta) throws SQLException {
        var layout = mapLoader.loadLayout(conn, mapId);
        if (layout == null) {
            throw new SQLException("Dungeon " + mapId + " konnte nicht geladen werden");
        }
        RoomCluster cluster = layout.findCluster(clusterId);
        if (cluster == null) {
            throw new SQLException("Cluster " + clusterId + " existiert nicht");
        }
        return cluster.movedBy(delta, levelDelta);
    }

    private static Map<Integer, TileShape> shapesByLevel(RoomCluster cluster) {
        Map<Integer, java.util.Set<Point2i>> cellsByLevel = new LinkedHashMap<>();
        if (cluster != null) {
            for (Room room : cluster.rooms()) {
                if (room == null) {
                    continue;
                }
                for (Map.Entry<Integer, features.world.dungeonmap.model.objects.Floor> entry : room.floors().entrySet()) {
                    if (entry == null || entry.getKey() == null || entry.getValue() == null) {
                        continue;
                    }
                    cellsByLevel.computeIfAbsent(entry.getKey(), ignored -> new java.util.LinkedHashSet<>())
                            .addAll(entry.getValue().shape().absoluteCells());
                }
            }
        }
        if (cellsByLevel.isEmpty()) {
            return Map.of(0, TileShape.empty());
        }
        Map<Integer, TileShape> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, java.util.Set<Point2i>> entry : cellsByLevel.entrySet()) {
            result.put(entry.getKey(), TileShape.fromAbsoluteCells(entry.getValue()));
        }
        return Map.copyOf(result);
    }

    private static int primaryLevel(RoomCluster cluster) {
        return shapesByLevel(cluster).keySet().stream()
                .mapToInt(Integer::intValue)
                .min()
                .orElse(0);
    }
}
