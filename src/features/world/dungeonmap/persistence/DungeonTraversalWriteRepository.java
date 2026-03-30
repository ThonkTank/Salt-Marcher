package features.world.dungeonmap.persistence;

import features.world.dungeonmap.model.structures.traversal.TraversalDoorBinding;
import features.world.dungeonmap.model.structures.traversal.TraversalWaypointBinding;

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

public final class DungeonTraversalWriteRepository {

    private static final TraversalSegmentTableSpec CORRIDOR_SEGMENTS =
            new TraversalSegmentTableSpec("dungeon_traversal_corridor_segments", "corridor_id");
    private static final TraversalSegmentTableSpec STAIR_SEGMENTS =
            new TraversalSegmentTableSpec("dungeon_traversal_stair_segments", "stair_id");

    public long insertTraversal(Connection conn, long mapId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_traversals(dungeon_map_id) VALUES(?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, mapId);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (!rs.next()) {
                    throw new SQLException("No key returned for dungeon_traversals insert");
                }
                return rs.getLong(1);
            }
        }
    }

    public void replaceTraversalRooms(Connection conn, long traversalId, List<Long> roomIds) throws SQLException {
        List<Long> normalizedRoomIds = normalizeRoomIds(roomIds);
        if (normalizedRoomIds.size() < 2) {
            deleteTraversal(conn, traversalId);
            return;
        }
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_traversal_members WHERE traversal_id=?")) {
            delete.setLong(1, traversalId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_traversal_members(traversal_id, room_id, member_order) VALUES(?,?,?)")) {
            for (int index = 0; index < normalizedRoomIds.size(); index++) {
                insert.setLong(1, traversalId);
                insert.setLong(2, normalizedRoomIds.get(index));
                insert.setInt(3, index);
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    public void replaceTraversalWaypoints(Connection conn, long traversalId, List<TraversalWaypointBinding> waypoints) throws SQLException {
        List<TraversalWaypointBinding> sanitized = waypoints == null ? List.of() : waypoints.stream()
                .filter(java.util.Objects::nonNull)
                .toList();
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_traversal_waypoints WHERE traversal_id=?")) {
            delete.setLong(1, traversalId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_traversal_waypoints(traversal_id, sort_order, cluster_id, relative_x, relative_y, relative_z) VALUES(?,?,?,?,?,?)")) {
            for (int index = 0; index < sanitized.size(); index++) {
                TraversalWaypointBinding waypoint = sanitized.get(index);
                insert.setLong(1, traversalId);
                insert.setInt(2, index);
                insert.setLong(3, waypoint.clusterId());
                insert.setInt(4, waypoint.relativeCell().x());
                insert.setInt(5, waypoint.relativeCell().y());
                insert.setInt(6, waypoint.levelZ());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    public void replaceTraversalDoorBindings(Connection conn, long traversalId, List<TraversalDoorBinding> doorBindings) throws SQLException {
        List<TraversalDoorBinding> sanitized = doorBindings == null ? List.of() : doorBindings.stream()
                .filter(java.util.Objects::nonNull)
                .toList();
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_traversal_door_bindings WHERE traversal_id=?")) {
            delete.setLong(1, traversalId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_traversal_door_bindings(traversal_id, room_id, cluster_id, relative_cell_x, relative_cell_y, edge_direction, sort_order) VALUES(?,?,?,?,?,?,?)")) {
            for (int index = 0; index < sanitized.size(); index++) {
                TraversalDoorBinding binding = sanitized.get(index);
                insert.setLong(1, traversalId);
                insert.setLong(2, binding.roomId());
                insert.setLong(3, binding.clusterId());
                insert.setInt(4, binding.relativeCell().x());
                insert.setInt(5, binding.relativeCell().y());
                insert.setString(6, DungeonPersistenceDirections.toPersistedEdgeDirection(binding.direction()));
                insert.setInt(7, index);
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    public Map<String, Long> loadTraversalCorridorSegments(Connection conn, long traversalId) throws SQLException {
        return loadTraversalSegments(conn, traversalId, CORRIDOR_SEGMENTS);
    }

    public List<Long> replaceTraversalCorridorSegments(Connection conn, long traversalId, Map<String, Long> corridorIdsBySegmentKey) throws SQLException {
        return replaceTraversalSegments(conn, traversalId, corridorIdsBySegmentKey, CORRIDOR_SEGMENTS);
    }

    public List<Long> deleteTraversalCorridorSegments(Connection conn, long traversalId) throws SQLException {
        return deleteTraversalSegments(conn, traversalId, CORRIDOR_SEGMENTS);
    }

    public Map<String, Long> loadTraversalStairSegments(Connection conn, long traversalId) throws SQLException {
        return loadTraversalSegments(conn, traversalId, STAIR_SEGMENTS);
    }

    public List<Long> replaceTraversalStairSegments(Connection conn, long traversalId, Map<String, Long> stairIdsBySegmentKey) throws SQLException {
        return replaceTraversalSegments(conn, traversalId, stairIdsBySegmentKey, STAIR_SEGMENTS);
    }

    public List<Long> deleteTraversalStairSegments(Connection conn, long traversalId) throws SQLException {
        return deleteTraversalSegments(conn, traversalId, STAIR_SEGMENTS);
    }

    public void deleteTraversal(Connection conn, long traversalId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_traversals WHERE traversal_id=?")) {
            ps.setLong(1, traversalId);
            ps.executeUpdate();
        }
    }

    private static Map<String, Long> loadTraversalSegments(
            Connection conn,
            long traversalId,
            TraversalSegmentTableSpec tableSpec
    ) throws SQLException {
        LinkedHashMap<String, Long> result = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(tableSpec.selectSql())) {
            ps.setLong(1, traversalId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String segmentKey = normalizeSegmentKey(rs.getString("segment_key"));
                    long structureId = rs.getLong(tableSpec.idColumn());
                    if (segmentKey != null) {
                        result.put(segmentKey, structureId);
                    }
                }
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static List<Long> replaceTraversalSegments(
            Connection conn,
            long traversalId,
            Map<String, Long> structureIdsBySegmentKey,
            TraversalSegmentTableSpec tableSpec
    ) throws SQLException {
        Map<String, Long> desired = normalizeSegmentIds(structureIdsBySegmentKey);
        Map<String, Long> existing = loadTraversalSegments(conn, traversalId, tableSpec);
        LinkedHashSet<Long> removedIds = new LinkedHashSet<>(existing.values());
        removedIds.removeAll(desired.values());
        deleteTraversalSegments(conn, traversalId, tableSpec);
        try (PreparedStatement insert = conn.prepareStatement(tableSpec.insertSql())) {
            int sortOrder = 0;
            for (Map.Entry<String, Long> entry : desired.entrySet()) {
                insert.setLong(1, traversalId);
                insert.setString(2, entry.getKey());
                insert.setLong(3, entry.getValue());
                insert.setInt(4, sortOrder++);
                insert.addBatch();
            }
            insert.executeBatch();
        }
        return removedIds.isEmpty() ? List.of() : List.copyOf(removedIds);
    }

    private static List<Long> deleteTraversalSegments(
            Connection conn,
            long traversalId,
            TraversalSegmentTableSpec tableSpec
    ) throws SQLException {
        List<Long> existingIds = new ArrayList<>(loadTraversalSegments(conn, traversalId, tableSpec).values());
        try (PreparedStatement delete = conn.prepareStatement(tableSpec.deleteSql())) {
            delete.setLong(1, traversalId);
            delete.executeUpdate();
        }
        return existingIds.isEmpty() ? List.of() : List.copyOf(existingIds);
    }

    private static List<Long> normalizeRoomIds(List<Long> roomIds) {
        LinkedHashSet<Long> uniqueIds = new LinkedHashSet<>();
        for (Long roomId : roomIds == null ? List.<Long>of() : roomIds) {
            if (roomId != null) {
                uniqueIds.add(roomId);
            }
        }
        return List.copyOf(uniqueIds);
    }

    private static Map<String, Long> normalizeSegmentIds(Map<String, Long> raw) {
        if (raw == null || raw.isEmpty()) {
            return Map.of();
        }
        LinkedHashMap<String, Long> normalized = new LinkedHashMap<>();
        for (Map.Entry<String, Long> entry : raw.entrySet()) {
            String segmentKey = normalizeSegmentKey(entry.getKey());
            Long structureId = entry.getValue();
            if (segmentKey != null && structureId != null) {
                normalized.put(segmentKey, structureId);
            }
        }
        return normalized.isEmpty() ? Map.of() : Map.copyOf(normalized);
    }

    private static String normalizeSegmentKey(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
    private record TraversalSegmentTableSpec(
            String tableName,
            String idColumn
    ) {
        private String selectSql() {
            return "SELECT segment_key, " + idColumn
                    + " FROM " + tableName
                    + " WHERE traversal_id=?"
                    + " ORDER BY sort_order, segment_key";
        }

        private String insertSql() {
            return "INSERT INTO " + tableName + "(traversal_id, segment_key, " + idColumn + ", sort_order) VALUES(?,?,?,?)";
        }

        private String deleteSql() {
            return "DELETE FROM " + tableName + " WHERE traversal_id=?";
        }
    }
}
