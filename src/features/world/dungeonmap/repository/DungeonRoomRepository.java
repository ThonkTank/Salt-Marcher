package features.world.dungeonmap.repository;

import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.structure.model.Structure;
import features.world.dungeonmap.structure.model.StructureSpecification;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.room.RoomExitNarration;
import features.world.dungeonmap.model.structures.room.RoomNarration;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.structure.repository.DungeonStructureRepository;

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

public final class DungeonRoomRepository {

    private final DungeonStructureRepository structureRepository = new DungeonStructureRepository();

    public List<Room> loadRooms(Connection conn, long mapId) throws SQLException {
        Map<Long, Map<Integer, GridPoint>> anchorsByRoomId = loadRoomAnchors(conn, mapId);
        Map<Long, List<RoomExitNarration>> exitNarrationsByRoomId = loadGrouped(
                conn,
                "SELECT room_id, level_z, cell_x, cell_y, edge_direction, description"
                        + " FROM dungeon_room_exit_descriptions"
                        + " WHERE room_id IN (SELECT room_id FROM dungeon_rooms WHERE dungeon_map_id=?)"
                        + " ORDER BY room_id, level_z, sort_order, cell_y, cell_x, edge_direction",
                mapId,
                rs -> rs.getLong("room_id"),
                rs -> new RoomExitNarration(
                        rs.getInt("level_z"),
                        new GridPoint(rs.getInt("cell_x"), rs.getInt("cell_y")),
                        DungeonPersistenceDirections.fromPersistedEdgeDirection(rs.getString("edge_direction")),
                        rs.getString("description")));
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT room_id, dungeon_map_id, cluster_id, name, visual_description"
                        + " FROM dungeon_rooms WHERE dungeon_map_id=? ORDER BY room_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                List<Room> rooms = new ArrayList<>();
                while (rs.next()) {
                    long roomId = rs.getLong("room_id");
                    Map<Integer, GridPoint> anchorsByLevel = anchorsByRoomId.get(roomId);
                    if (anchorsByLevel == null || anchorsByLevel.isEmpty()) {
                        throw new IllegalStateException("Raum " + roomId + " hat keine persistierten Level-Anker");
                    }
                    rooms.add(Room.metadata(
                            roomId,
                            rs.getLong("dungeon_map_id"),
                            rs.getLong("cluster_id"),
                            normalizedRoomName(roomId, rs.getString("name")),
                            anchorsByLevel,
                            new RoomNarration(
                                    rs.getString("visual_description"),
                                    exitNarrationsByRoomId.getOrDefault(roomId, List.of()))));
                }
                return rooms.isEmpty() ? List.of() : List.copyOf(rooms);
            }
        }
    }

    public List<RoomCluster> loadClusters(Connection conn, long mapId, List<Room> rooms) throws SQLException {
        List<RoomCluster> clusters = new ArrayList<>();
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
                "SELECT cluster_id, dungeon_map_id, structure_object_id, center_x, center_y FROM dungeon_room_clusters"
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
                    clusters.add(new RoomCluster(
                            clusterId,
                            structureObjectId,
                            rs.getLong("dungeon_map_id"),
                            new GridPoint(rs.getInt("center_x"), rs.getInt("center_y")),
                            structure,
                            roomsByClusterId.getOrDefault(clusterId, List.of())));
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

    public void createClusterWithRoom(
            Connection conn,
            long mapId,
            int levelZ,
            Set<GridPoint> cells,
            String roomName
    ) throws SQLException {
        Set<GridPoint> resolvedCells = cells == null ? Set.of() : Set.copyOf(cells);
        if (resolvedCells.isEmpty()) {
            return;
        }
        Structure structure = Structure.fromSpecification(StructureSpecification.ofLevel(
                levelZ,
                StructureSpecification.LevelSpecification.of(
                        GridPoint.bestCenter(resolvedCells),
                        resolvedCells,
                        resolvedCells,
                        List.of(),
                        List.of())));
        DungeonStructureRepository.PersistedStructure persistedStructure = structureRepository.save(conn, null, structure);
        long clusterId = insertCluster(conn, mapId, GridPoint.bestCenter(resolvedCells), persistedStructure.structureObjectId());
        insertRoom(
                conn,
                mapId,
                clusterId,
                roomName,
                Map.of(levelZ, GridPoint.bestCenter(resolvedCells)));
    }

    /**
     * Realizes the room workflow's final cluster owners directly instead of replaying a second rewrite payload.
     */
    public void replaceClusters(
            Connection conn,
            long mapId,
            List<RoomCluster> originalClusters,
            List<RoomCluster> finalClusters
    ) throws SQLException {
        List<RoomCluster> resolvedOriginalClusters = normalizedClusters(originalClusters);
        List<RoomCluster> resolvedFinalClusters = normalizedClusters(finalClusters);
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
        for (RoomCluster cluster : resolvedFinalClusters) {
            if (cluster == null || cluster.clusterId() == null) {
                continue;
            }
            retainedClusterIds.add(cluster.clusterId());
            updateClusterMetadata(conn, cluster.clusterId(), cluster.center());
            if (cluster.structureObjectId() == null || cluster.structureObjectId() <= 0L) {
                throw new IllegalArgumentException("Persisted cluster requires a structure object id");
            }
            structureRepository.save(conn, cluster.structureObjectId(), cluster.structure());
            persistRooms(conn, mapId, cluster.clusterId(), cluster.structure().roomTopology().rooms());
        }

        for (RoomCluster cluster : resolvedFinalClusters) {
            if (cluster == null || cluster.clusterId() != null) {
                continue;
            }
            DungeonStructureRepository.PersistedStructure persistedStructure =
                    structureRepository.save(conn, null, cluster.structure());
            long clusterId = insertCluster(conn, mapId, cluster.center(), persistedStructure.structureObjectId());
            persistRooms(conn, mapId, clusterId, cluster.structure().roomTopology().rooms());
        }

        for (RoomCluster cluster : resolvedOriginalClusters) {
            if (cluster == null || cluster.clusterId() == null || retainedClusterIds.contains(cluster.clusterId())) {
                continue;
            }
            deleteCluster(conn, cluster.clusterId());
            structureRepository.delete(conn, cluster.structureObjectId());
        }
    }

    public void saveMovedCluster(Connection conn, RoomCluster cluster) throws SQLException {
        if (cluster == null || cluster.clusterId() == null) {
            return;
        }
        updateClusterMetadata(conn, cluster.clusterId(), cluster.center());
        if (cluster.structureObjectId() == null || cluster.structureObjectId() <= 0L) {
            throw new IllegalArgumentException("Persisted cluster requires a structure object id");
        }
        structureRepository.save(conn, cluster.structureObjectId(), cluster.structure());
        persistRooms(conn, cluster.mapId(), cluster.clusterId(), cluster.structure().roomTopology().rooms());
    }

    public void saveRooms(Connection conn, long mapId, List<Room> rooms) throws SQLException {
        if (conn == null || rooms == null || rooms.isEmpty()) {
            return;
        }
        for (Room room : rooms) {
            if (room == null || room.roomId() == null) {
                continue;
            }
            reassignRoomCluster(conn, room.roomId(), room.clusterId());
            updateRoom(conn, room.roomId(), room.name(), room.anchorsByLevel());
        }
    }

    private long insertCluster(Connection conn, long mapId, GridPoint center, long structureObjectId) throws SQLException {
        GridPoint resolvedCenter = center == null ? new GridPoint(0, 0) : center;
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_room_clusters(dungeon_map_id, structure_object_id, center_x, center_y) VALUES(?,?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, mapId);
            ps.setLong(2, structureObjectId);
            ps.setInt(3, resolvedCenter.x());
            ps.setInt(4, resolvedCenter.y());
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (!rs.next()) {
                    throw new SQLException("No key returned for dungeon_room_clusters insert");
                }
                return rs.getLong(1);
            }
        }
    }

    private void updateClusterMetadata(Connection conn, long clusterId, GridPoint center) throws SQLException {
        GridPoint resolvedCenter = center == null ? new GridPoint(0, 0) : center;
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_room_clusters SET center_x=?, center_y=? WHERE cluster_id=?")) {
            ps.setInt(1, resolvedCenter.x());
            ps.setInt(2, resolvedCenter.y());
            ps.setLong(3, clusterId);
            ps.executeUpdate();
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
            ps.setInt(4, primaryAnchor.x());
            ps.setInt(5, primaryAnchor.y());
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
            ps.setInt(2, primaryAnchor.x());
            ps.setInt(3, primaryAnchor.y());
            ps.setInt(4, primaryLevel);
            ps.setLong(5, roomId);
            ps.executeUpdate();
        }
        replaceRoomAnchors(conn, roomId, resolvedAnchors);
    }

    public void replaceRoomNarration(Connection conn, long roomId, RoomNarration narration) throws SQLException {
        RoomNarration resolvedNarration = narration == null ? RoomNarration.empty() : narration;
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_rooms SET visual_description=? WHERE room_id=?")) {
            ps.setString(1, resolvedNarration.visualDescription());
            ps.setLong(2, roomId);
            ps.executeUpdate();
        }
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_room_exit_descriptions WHERE room_id=?")) {
            delete.setLong(1, roomId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_room_exit_descriptions(room_id, level_z, cell_x, cell_y, edge_direction, description, sort_order)"
                        + " VALUES(?,?,?,?,?,?,?)")) {
            int sortOrder = 0;
            for (RoomExitNarration exitNarration : resolvedNarration.exitNarrations()) {
                insert.setLong(1, roomId);
                insert.setInt(2, exitNarration.levelZ());
                insert.setInt(3, exitNarration.roomCell().x());
                insert.setInt(4, exitNarration.roomCell().y());
                insert.setString(5, DungeonPersistenceDirections.toPersistedEdgeDirection(exitNarration.direction()));
                insert.setString(6, exitNarration.description());
                insert.setInt(7, sortOrder++);
                insert.addBatch();
            }
            insert.executeBatch();
        }
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
        return anchorsByLevel.getOrDefault(primaryLevel(anchorsByLevel), new GridPoint(0, 0));
    }

    private static int persistedCellX2(GridPoint cell) {
        GridPoint resolvedCell = cell == null ? new GridPoint(0, 0) : cell;
        return GridPoint.cell(resolvedCell).x2();
    }

    private static int persistedCellY2(GridPoint cell) {
        GridPoint resolvedCell = cell == null ? new GridPoint(0, 0) : cell;
        return GridPoint.cell(resolvedCell).y2();
    }

    private static Map<Long, Map<Integer, GridPoint>> loadRoomAnchors(Connection conn, long mapId) throws SQLException {
        Map<Long, Map<Integer, GridPoint>> anchorsByRoomId = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT room_id, level_z, anchor_x2, anchor_y2"
                        + " FROM dungeon_room_levels"
                        + " WHERE room_id IN (SELECT room_id FROM dungeon_rooms WHERE dungeon_map_id=?)"
                        + " ORDER BY room_id, level_z")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    anchorsByRoomId.computeIfAbsent(rs.getLong("room_id"), ignored -> new LinkedHashMap<>())
                            .put(rs.getInt("level_z"), requireStoredCellCenter(
                                    rs.getInt("anchor_x2"),
                                    rs.getInt("anchor_y2"),
                                    "room anchor",
                                    rs.getLong("room_id"),
                                    rs.getInt("level_z")));
                }
            }
        }
        Map<Long, Map<Integer, GridPoint>> result = new LinkedHashMap<>();
        for (Map.Entry<Long, Map<Integer, GridPoint>> entry : anchorsByRoomId.entrySet()) {
            result.put(entry.getKey(), Map.copyOf(entry.getValue()));
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
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

    private static GridPoint requireStoredCellCenter(int persistedX2, int persistedY2, String label, long roomId, int levelZ) {
        return GridPoint.raw(persistedX2, persistedY2).asCell().orElseThrow(() -> new IllegalArgumentException(
                label + " must be a tile center for room " + roomId + " at level " + levelZ));
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

    private static <K, V> Map<K, List<V>> loadGrouped(
            Connection conn,
            String sql,
            long mapId,
            ResultSetMapper<K> keyExtractor,
            ResultSetMapper<V> valueExtractor
    ) throws SQLException {
        Map<K, List<V>> result = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    K key = keyExtractor.map(rs);
                    V value = valueExtractor.map(rs);
                    if (value != null) {
                        result.computeIfAbsent(key, ignored -> new ArrayList<>()).add(value);
                    } else {
                        result.computeIfAbsent(key, ignored -> new ArrayList<>());
                    }
                }
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static String normalizedRoomName(long roomId, String name) {
        return name == null || name.isBlank() ? "Raum " + roomId : name.trim();
    }

    private static List<RoomCluster> normalizedClusters(List<RoomCluster> clusters) {
        if (clusters == null || clusters.isEmpty()) {
            return List.of();
        }
        List<RoomCluster> result = new ArrayList<>();
        Set<Long> seenClusterIds = new LinkedHashSet<>();
        for (RoomCluster cluster : clusters) {
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

    private static Set<Long> roomIds(List<RoomCluster> clusters) {
        LinkedHashSet<Long> result = new LinkedHashSet<>();
        for (RoomCluster cluster : clusters == null ? List.<RoomCluster>of() : clusters) {
            if (cluster == null) {
                continue;
            }
            for (Room room : cluster.structure().roomTopology().rooms()) {
                if (room != null && room.roomId() != null) {
                    result.add(room.roomId());
                }
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    @FunctionalInterface
    private interface ResultSetMapper<T> {
        T map(ResultSet rs) throws SQLException;
    }

}
