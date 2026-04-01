package features.world.dungeonmap.application.room;

import database.DatabaseManager;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.loading.DungeonMapLoader;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.objects.Floor;
import features.world.dungeonmap.model.structures.cluster.ClusterRewrite;
import features.world.dungeonmap.model.structures.cluster.ClusterRewriteSplit;
import features.world.dungeonmap.model.structures.cluster.InternalBoundaryType;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.persistence.DungeonRoomWriteRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class DungeonRoomTopologyService {

    private final DungeonMapLoader mapLoader;
    private final DungeonRoomWriteRepository roomWriteRepository;

    public DungeonRoomTopologyService(
            DungeonMapLoader mapLoader,
            DungeonRoomWriteRepository roomWriteRepository
    ) {
        this.mapLoader = Objects.requireNonNull(mapLoader, "mapLoader");
        this.roomWriteRepository = Objects.requireNonNull(roomWriteRepository, "roomWriteRepository");
    }

    public void paint(long mapId, int levelZ, TileShape shape) throws SQLException {
        if (shape == null || shape.size() == 0) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                paint(conn, mapId, levelZ, shape);
                return null;
            });
        }
    }

    public void paint(Connection conn, long mapId, int levelZ, TileShape shape) throws SQLException {
        if (shape == null || shape.size() == 0) {
            return;
        }
        DungeonLayout layout = requireLayout(conn, mapId);
        List<RoomCluster> overlappingClusters = overlappingClustersAtLevel(layout, shape, levelZ).stream()
                .sorted(Comparator.comparing(cluster -> cluster.clusterId() == null ? Long.MAX_VALUE : cluster.clusterId()))
                .toList();
        if (overlappingClusters.isEmpty()) {
            createCluster(conn, mapId, levelZ, shape, nextRoomName(layout, new LinkedHashSet<>()));
            return;
        }

        ClusterRewrite rewrite = overlappingClusters.getFirst().applyPaint(shape, overlappingClusters, levelZ);
        if (rewrite.isNoOp()) {
            return;
        }

        persistClusterRewrite(conn, mapId, rewrite, levelZ);
    }

    public void delete(long mapId, int levelZ, TileShape shape) throws SQLException {
        if (shape == null || shape.size() == 0) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                delete(conn, mapId, levelZ, shape);
                return null;
            });
        }
    }

    public void delete(Connection conn, long mapId, int levelZ, TileShape shape) throws SQLException {
        if (shape == null || shape.size() == 0) {
            return;
        }
        DungeonLayout workingLayout = requireLayout(conn, mapId);
        Set<String> reservedNames = new LinkedHashSet<>();
        for (Room room : workingLayout.rooms()) {
            if (room != null && room.name() != null && !room.name().isBlank()) {
                reservedNames.add(room.name());
            }
        }

        List<Long> affectedClusterIds = overlappingClustersAtLevel(workingLayout, shape, levelZ).stream()
                .map(RoomCluster::clusterId)
                .filter(Objects::nonNull)
                .sorted()
                .toList();
        for (Long clusterId : affectedClusterIds) {
            RoomCluster cluster = workingLayout.findCluster(clusterId);
            if (cluster == null) {
                continue;
            }
            DungeonLayout layoutSnapshot = workingLayout;
            ClusterRewrite rewrite = cluster.applyDelete(shape, () -> nextRoomName(layoutSnapshot, reservedNames), levelZ);
            if (rewrite.isNoOp()) {
                continue;
            }
            ClusterRewrite persistedRewrite = persistClusterRewrite(
                    conn,
                    mapId,
                    rewrite,
                    workingLayout.levelForCluster(rewrite.targetClusterId()));
            workingLayout = workingLayout.applying(persistedRewrite);
        }
    }

    public void createDefaultRoom(Connection conn, long mapId) throws SQLException {
        createCluster(conn, mapId, 0, TileShape.singleCell(new Point2i(0, 0)), "Eingang");
    }

    public void ensureTraversableCell(Connection conn, long mapId, Point2i cell, int levelZ) throws SQLException {
        if (cell == null) {
            return;
        }
        DungeonLayout layout = requireLayout(conn, mapId);
        if (layout.isTraversableCell(CubePoint.at(cell, levelZ))) {
            return;
        }
        paint(conn, mapId, levelZ, TileShape.singleCell(cell));
    }

    public void editBoundary(
            Connection conn,
            long mapId,
            long clusterId,
            VertexEdge edge,
            InternalBoundaryType type,
            boolean deleteBoundary
    ) throws SQLException {
        editBoundary(conn, mapId, clusterId, edge == null ? List.<VertexEdge>of() : List.of(edge), type, deleteBoundary);
    }

    public void editBoundary(
            Connection conn,
            long mapId,
            long clusterId,
            Collection<VertexEdge> edges,
            InternalBoundaryType type,
            boolean deleteBoundary
    ) throws SQLException {
        if (edges == null || edges.isEmpty()) {
            return;
        }
        DungeonLayout layout = requireLayout(conn, mapId);
        RoomCluster cluster = layout.findCluster(clusterId);
        if (cluster == null) {
            return;
        }
        ClusterRewrite rewrite = cluster.editBoundary(edges, type, deleteBoundary);
        if (rewrite == null) {
            return;
        }

        persistClusterRewrite(conn, mapId, rewrite, layout.levelForCluster(rewrite.targetClusterId()));
    }

    private void createCluster(Connection conn, long mapId, int levelZ, TileShape shape, String roomName) throws SQLException {
        long clusterId = roomWriteRepository.insertCluster(
                conn,
                mapId,
                shape.centerCell(),
                levelZ);
        roomWriteRepository.insertRoom(
                conn,
                mapId,
                clusterId,
                roomName,
                Room.create(null, mapId, clusterId, roomName, Map.of(levelZ, new Floor(shape))).structure().descriptor());
    }

    private ClusterRewrite persistClusterRewrite(Connection conn, long mapId, ClusterRewrite rewrite, int levelZ) throws SQLException {
        if (rewrite == null || rewrite.targetClusterId() == null) {
            return rewrite;
        }
        for (Long roomId : rewrite.deletedRoomIds()) {
            if (roomId != null) {
                roomWriteRepository.deleteRoom(conn, roomId);
            }
        }
        if (rewrite.deletesCluster()) {
            roomWriteRepository.deleteCluster(conn, rewrite.targetClusterId());
            return rewrite;
        }
        List<ClusterRewriteSplit> realizedSplitClusters = new java.util.ArrayList<>();
        for (ClusterRewriteSplit splitCluster : rewrite.splitClusters()) {
            long splitClusterId = roomWriteRepository.insertCluster(
                    conn,
                    mapId,
                    splitCluster.clusterCenter(),
                    primaryLevel(splitCluster.rooms(), levelZ));
            realizedSplitClusters.add(splitCluster.withClusterId(splitClusterId));
        }
        ClusterRewrite realizedRewrite = rewrite.withSplitClusters(realizedSplitClusters);
        roomWriteRepository.updateClusterMetadata(
                conn,
                realizedRewrite.targetClusterId(),
                realizedRewrite.clusterCenter(),
                primaryLevel(realizedRewrite.rooms(), levelZ));
        persistRooms(conn, mapId, realizedRewrite.targetClusterId(), realizedRewrite.rooms());
        for (ClusterRewriteSplit splitCluster : realizedRewrite.splitClusters()) {
            persistRooms(conn, mapId, splitCluster.clusterId(), splitCluster.rooms());
        }
        for (Long deletedClusterId : realizedRewrite.deletedClusterIds()) {
            if (deletedClusterId != null && !deletedClusterId.equals(realizedRewrite.targetClusterId())) {
                roomWriteRepository.deleteCluster(conn, deletedClusterId);
            }
        }
        return realizedRewrite;
    }

    private void persistRooms(
            Connection conn,
            long mapId,
            long clusterId,
            List<Room> rooms
    ) throws SQLException {
        for (Room room : rooms) {
            if (room == null) {
                continue;
            }
            if (room.roomId() == null) {
                long roomId = roomWriteRepository.insertRoom(
                        conn,
                        mapId,
                        clusterId,
                        room.name(),
                        room.structure().descriptor());
                if (roomId <= 0) {
                    throw new SQLException("Raum konnte nicht angelegt werden");
                }
                continue;
            }
            roomWriteRepository.reassignRoomCluster(conn, room.roomId(), clusterId);
            roomWriteRepository.updateRoom(conn, room.roomId(), room.name(), room.structure().descriptor());
        }
    }

    private static int primaryLevel(List<Room> rooms, int fallbackLevel) {
        return (rooms == null ? List.<Room>of() : rooms).stream()
                .filter(Objects::nonNull)
                .flatMap(room -> room.structure().levels().stream())
                .mapToInt(Integer::intValue)
                .min()
                .orElse(fallbackLevel);
    }

    private static List<RoomCluster> overlappingClustersAtLevel(DungeonLayout layout, TileShape shape, int levelZ) {
        return layout.overlappingClusters(shape).stream()
                .filter(cluster -> cluster != null && cluster.rooms().stream()
                        .anyMatch(room -> room != null
                                && room.structure().levels().contains(levelZ)))
                .toList();
    }

    private static String nextRoomName(DungeonLayout layout, Set<String> reservedNames) {
        Set<String> used = new LinkedHashSet<>(reservedNames);
        for (Room room : layout.rooms()) {
            if (room != null && room.name() != null && !room.name().isBlank()) {
                used.add(room.name());
            }
        }
        int next = 1;
        while (used.contains("Raum " + next)) {
            next++;
        }
        String result = "Raum " + next;
        used.add(result);
        reservedNames.add(result);
        return result;
    }

    private DungeonLayout requireLayout(Connection conn, long mapId) throws SQLException {
        DungeonLayout layout = mapLoader.loadLayout(conn, mapId);
        if (layout == null) {
            throw new SQLException("Dungeon " + mapId + " konnte nicht geladen werden");
        }
        return layout;
    }
}
