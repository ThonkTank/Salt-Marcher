package features.world.dungeon.dungeonmap.cluster.repository;

import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.dungeonmap.structure.model.Structure;
import features.world.dungeon.dungeonmap.cluster.model.Cluster;
import features.world.dungeon.dungeonmap.cluster.model.ClusterDefinitionRequest;
import features.world.dungeon.dungeonmap.cluster.model.ClusterRewriteRequest;
import features.world.dungeon.model.structures.room.Room;
import features.world.dungeon.dungeonmap.structure.repository.DungeonStructureRepository;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class DungeonClusterRepository {

    private final DungeonStructureRepository structureRepository = new DungeonStructureRepository();

    public List<Cluster> loadClusters(Connection conn, long mapId, List<Room> rooms) throws SQLException {
        List<Cluster> clusters = new ArrayList<>();
        Map<Long, List<Room>> roomsByClusterId = roomsByClusterId(rooms);
        Map<Long, Long> structureIdsByClusterId = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT cluster_id, structure_object_id FROM dungeon_room_clusters"
                        + " WHERE dungeon_map_id=? ORDER BY cluster_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    structureIdsByClusterId.put(rs.getLong("cluster_id"), rs.getLong("structure_object_id"));
                }
            }
        }
        Map<Long, Structure> structuresById = structureRepository.loadByIds(conn, structureIdsByClusterId.values());
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT cluster_id, dungeon_map_id, structure_object_id FROM dungeon_room_clusters"
                        + " WHERE dungeon_map_id=? ORDER BY cluster_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long clusterId = rs.getLong("cluster_id");
                    long structureObjectId = rs.getLong("structure_object_id");
                    Structure structure = structuresById.get(structureObjectId);
                    if (structure == null || structure.levels().isEmpty()) {
                        throw new IllegalStateException("Cluster " + clusterId + " hat keine persistierte Strukturbeschreibung");
                    }
                    clusters.add(Cluster.fromDefinition(new ClusterDefinitionRequest(
                            clusterId,
                            structureObjectId,
                            rs.getLong("dungeon_map_id"),
                            structure,
                            roomsByClusterId.getOrDefault(clusterId, List.of()))));
                }
            }
        }
        return clusters.isEmpty() ? List.of() : List.copyOf(clusters);
    }

    public Map<Long, Integer> loadClusterLevels(Connection conn, long mapId) throws SQLException {
        return loadLevelMap(conn,
                "SELECT c.cluster_id AS entity_id, MIN(sl.level_z) AS level_z"
                        + " FROM dungeon_room_clusters c"
                        + " JOIN dungeon_structure_levels sl ON sl.structure_object_id=c.structure_object_id"
                        + " WHERE c.dungeon_map_id=?"
                        + " GROUP BY c.cluster_id",
                mapId);
    }

    /**
     * Canonical cluster persistence seam: realize one final rewrite payload directly into persisted structure
     * and room metadata state.
     */
    public void persistRewrite(
            Connection conn,
            long mapId,
            ClusterRewriteRequest rewriteRequest
    ) throws SQLException {
        if (rewriteRequest == null) {
            return;
        }
        List<Cluster> resolvedOriginalClusters = normalizedClusters(rewriteRequest.originalClusters());
        List<Cluster> resolvedFinalClusters = normalizedClusters(rewriteRequest.rewrittenClusters());
        if (resolvedOriginalClusters.isEmpty() && resolvedFinalClusters.isEmpty()) {
            return;
        }

        Set<Long> finalRoomIds = roomIds(resolvedFinalClusters);
        for (Long roomId : roomIds(resolvedOriginalClusters)) {
            if (roomId != null && !finalRoomIds.contains(roomId)) {
                deleteRoom(conn, roomId);
            }
        }

        Set<Long> retainedClusterIds = new LinkedHashSet<>();
        for (Cluster cluster : resolvedFinalClusters) {
            if (cluster == null || cluster.clusterId() == null) {
                continue;
            }
            retainedClusterIds.add(cluster.clusterId());
            if (cluster.structureObjectId() == null || cluster.structureObjectId() <= 0L) {
                throw new IllegalArgumentException("Persisted cluster requires a structure object id");
            }
            structureRepository.save(conn, cluster.structureObjectId(), cluster);
            persistRooms(conn, mapId, cluster.clusterId(), cluster.roomTopology().rooms());
        }

        for (Cluster cluster : resolvedFinalClusters) {
            if (cluster == null || cluster.clusterId() != null) {
                continue;
            }
            DungeonStructureRepository.PersistedStructure persistedStructure =
                    structureRepository.save(conn, null, cluster);
            long clusterId = insertCluster(conn, mapId, persistedStructure.structureObjectId());
            persistRooms(conn, mapId, clusterId, cluster.roomTopology().rooms());
        }

        for (Cluster cluster : resolvedOriginalClusters) {
            if (cluster == null || cluster.clusterId() == null || retainedClusterIds.contains(cluster.clusterId())) {
                continue;
            }
            deleteCluster(conn, cluster.clusterId());
            structureRepository.delete(conn, cluster.structureObjectId());
        }
    }

    private long insertCluster(Connection conn, long mapId, long structureObjectId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_room_clusters(dungeon_map_id, structure_object_id) VALUES(?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, mapId);
            ps.setLong(2, structureObjectId);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (!rs.next()) {
                    throw new SQLException("No key returned for dungeon_room_clusters insert");
                }
                return rs.getLong(1);
            }
        }
    }

    private void deleteCluster(Connection conn, long clusterId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_room_clusters WHERE cluster_id=?")) {
            ps.setLong(1, clusterId);
            ps.executeUpdate();
        }
    }

    private long insertRoom(
            Connection conn,
            long mapId,
            long clusterId,
            String name,
            Map<Integer, GridPoint> anchorsByLevel
    ) throws SQLException {
        Map<Integer, GridPoint> resolvedAnchors = requiredAnchors(anchorsByLevel);
        int primaryLevel = primaryLevel(resolvedAnchors);
        GridPoint primaryAnchor = primaryAnchorCell(resolvedAnchors);
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_rooms(dungeon_map_id, cluster_id, name, component_x, component_y, level_z) VALUES(?,?,?,?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, mapId);
            ps.setLong(2, clusterId);
            ps.setString(3, name);
            ps.setInt(4, primaryAnchor.x2() / 2);
            ps.setInt(5, primaryAnchor.y2() / 2);
            ps.setInt(6, primaryLevel);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (!rs.next()) {
                    throw new SQLException("No key returned for dungeon_rooms insert");
                }
                long roomId = rs.getLong(1);
                replaceRoomAnchors(conn, roomId, resolvedAnchors);
                return roomId;
            }
        }
    }

    private void updateRoom(
            Connection conn,
            long roomId,
            String name,
            Map<Integer, GridPoint> anchorsByLevel
    ) throws SQLException {
        Map<Integer, GridPoint> resolvedAnchors = requiredAnchors(anchorsByLevel);
        int primaryLevel = primaryLevel(resolvedAnchors);
        GridPoint primaryAnchor = primaryAnchorCell(resolvedAnchors);
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_rooms SET name=?, component_x=?, component_y=?, level_z=? WHERE room_id=?")) {
            ps.setString(1, name);
            ps.setInt(2, primaryAnchor.x2() / 2);
            ps.setInt(3, primaryAnchor.y2() / 2);
            ps.setInt(4, primaryLevel);
            ps.setLong(5, roomId);
            ps.executeUpdate();
        }
        replaceRoomAnchors(conn, roomId, resolvedAnchors);
    }

    private void reassignRoomCluster(Connection conn, long roomId, long clusterId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_rooms SET cluster_id=? WHERE room_id=?")) {
            ps.setLong(1, clusterId);
            ps.setLong(2, roomId);
            ps.executeUpdate();
        }
    }

    private void deleteRoom(Connection conn, long roomId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_rooms WHERE room_id=?")) {
            ps.setLong(1, roomId);
            ps.executeUpdate();
        }
    }

    private void replaceRoomAnchors(Connection conn, long roomId, Map<Integer, GridPoint> anchorsByLevel) throws SQLException {
        Map<Integer, GridPoint> resolvedAnchors = requiredAnchors(anchorsByLevel);
        try (PreparedStatement deleteLevels = conn.prepareStatement(
                "DELETE FROM dungeon_room_levels WHERE room_id=?")) {
            deleteLevels.setLong(1, roomId);
            deleteLevels.executeUpdate();
        }
        try (PreparedStatement insertLevel = conn.prepareStatement(
                "INSERT INTO dungeon_room_levels(room_id, level_z, anchor_x2, anchor_y2) VALUES(?,?,?,?)")) {
            for (var entry : resolvedAnchors.entrySet()) {
                insertLevel.setLong(1, roomId);
                insertLevel.setInt(2, entry.getKey());
                insertLevel.setInt(3, persistedCellX2(entry.getValue()));
                insertLevel.setInt(4, persistedCellY2(entry.getValue()));
                insertLevel.addBatch();
            }
            insertLevel.executeBatch();
        }
    }

    private void persistRooms(Connection conn, long mapId, long clusterId, List<Room> rooms) throws SQLException {
        for (Room room : rooms == null ? List.<Room>of() : rooms) {
            if (room == null) {
                continue;
            }
            if (room.roomId() == null) {
                insertRoom(
                        conn,
                        mapId,
                        clusterId,
                        room.name(),
                        room.anchorsByLevel());
                continue;
            }
            reassignRoomCluster(conn, room.roomId(), clusterId);
            updateRoom(conn, room.roomId(), room.name(), room.anchorsByLevel());
        }
    }

    private static Map<Integer, GridPoint> requiredAnchors(Map<Integer, GridPoint> anchorsByLevel) {
        if (anchorsByLevel == null || anchorsByLevel.isEmpty()) {
            throw new IllegalArgumentException("Room anchors must not be empty");
        }
        Map<Integer, GridPoint> result = new LinkedHashMap<>();
        anchorsByLevel.entrySet().stream()
                .filter(entry -> entry != null && entry.getKey() != null && entry.getValue() != null)
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> result.put(entry.getKey(), entry.getValue()));
        if (result.isEmpty()) {
            throw new IllegalArgumentException("Room anchors must not be empty");
        }
        return Map.copyOf(result);
    }

    private static int primaryLevel(Map<Integer, GridPoint> anchorsByLevel) {
        return anchorsByLevel.keySet().stream()
                .mapToInt(Integer::intValue)
                .min()
                .orElse(0);
    }

    private static GridPoint primaryAnchorCell(Map<Integer, GridPoint> anchorsByLevel) {
        return anchorsByLevel.getOrDefault(primaryLevel(anchorsByLevel), GridPoint.cell(0, 0, 0));
    }

    private static int persistedCellX2(GridPoint cell) {
        GridPoint resolvedCell = cell == null ? GridPoint.cell(0, 0, 0) : cell;
        return resolvedCell.x2();
    }

    private static int persistedCellY2(GridPoint cell) {
        GridPoint resolvedCell = cell == null ? GridPoint.cell(0, 0, 0) : cell;
        return resolvedCell.y2();
    }

    private static Map<Long, Integer> loadLevelMap(Connection conn, String sql, long mapId) throws SQLException {
        Map<Long, Integer> result = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.put(rs.getLong("entity_id"), rs.getInt("level_z"));
                }
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static Map<Long, List<Room>> roomsByClusterId(List<Room> rooms) {
        Map<Long, List<Room>> result = new LinkedHashMap<>();
        for (Room room : rooms == null ? List.<Room>of() : rooms) {
            if (room != null) {
                result.computeIfAbsent(room.clusterId(), ignored -> new ArrayList<>()).add(room);
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static List<Cluster> normalizedClusters(List<Cluster> clusters) {
        if (clusters == null || clusters.isEmpty()) {
            return List.of();
        }
        List<Cluster> result = new ArrayList<>();
        Set<Long> seenClusterIds = new LinkedHashSet<>();
        for (Cluster cluster : clusters) {
            if (cluster == null) {
                continue;
            }
            if (cluster.clusterId() == null) {
                result.add(cluster);
                continue;
            }
            if (seenClusterIds.add(cluster.clusterId())) {
                result.add(cluster);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static Set<Long> roomIds(List<Cluster> clusters) {
        LinkedHashSet<Long> result = new LinkedHashSet<>();
        for (Cluster cluster : clusters == null ? List.<Cluster>of() : clusters) {
            if (cluster == null) {
                continue;
            }
            for (Room room : cluster.roomTopology().rooms()) {
                if (room != null && room.roomId() != null) {
                    result.add(room.roomId());
                }
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

}
