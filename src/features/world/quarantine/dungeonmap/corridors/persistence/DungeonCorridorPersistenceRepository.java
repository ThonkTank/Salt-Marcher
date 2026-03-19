package features.world.quarantine.dungeonmap.corridors.persistence;

import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.corridors.model.binding.CorridorDoorOverride;
import features.world.quarantine.dungeonmap.corridors.model.binding.CorridorWaypoint;
import features.world.quarantine.dungeonmap.foundation.db.DungeonPersistenceBatch;
import features.world.quarantine.dungeonmap.foundation.db.DungeonPersistenceGuards;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;

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
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

public final class DungeonCorridorPersistenceRepository {

    private DungeonCorridorPersistenceRepository() {
        throw new AssertionError("No instances");
    }

    public static long insertCorridor(Connection conn, long mapId, List<Long> roomIds) throws SQLException {
        List<Long> normalizedRoomIds = normalizeRoomIds(roomIds);
        if (normalizedRoomIds.size() < 2) {
            throw new IllegalArgumentException("Korridorgruppe braucht mindestens zwei Räume");
        }
        for (Long roomId : normalizedRoomIds) {
            DungeonPersistenceGuards.ensureRoomBelongsToMap(conn, mapId, roomId);
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_corridors(dungeon_map_id) VALUES(?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, mapId);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (rs.next()) {
                    long corridorId = rs.getLong(1);
                    replaceCorridorRooms(conn, mapId, corridorId, normalizedRoomIds);
                    return corridorId;
                }
            }
        }
        throw new SQLException("Failed to resolve dungeon_corridors row");
    }

    public static void replaceCorridorRooms(Connection conn, long mapId, long corridorId, List<Long> roomIds) throws SQLException {
        DungeonPersistenceGuards.ensureCorridorBelongsToMap(conn, mapId, corridorId);
        List<Long> existingRoomIds = loadCorridorRoomIds(conn, corridorId);
        List<Long> normalizedRoomIds = normalizeRoomIds(roomIds);
        if (normalizedRoomIds.size() < 2) {
            deleteCorridor(conn, mapId, corridorId);
            return;
        }
        for (Long roomId : normalizedRoomIds) {
            DungeonPersistenceGuards.ensureRoomBelongsToMap(conn, mapId, roomId);
        }
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_corridor_members WHERE corridor_id=?")) {
            delete.setLong(1, corridorId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_corridor_members(corridor_id, room_id, member_order) VALUES(?,?,?)")) {
            for (int i = 0; i < normalizedRoomIds.size(); i++) {
                insert.setLong(1, corridorId);
                insert.setLong(2, normalizedRoomIds.get(i));
                insert.setInt(3, i);
                insert.addBatch();
            }
            insert.executeBatch();
        }
        for (Long existingRoomId : existingRoomIds) {
            if (!normalizedRoomIds.contains(existingRoomId)) {
                deleteCorridorDoorOverride(conn, corridorId, existingRoomId);
            }
        }
    }

    public static void addRoomToCorridor(Connection conn, long mapId, long corridorId, long roomId) throws SQLException {
        List<Long> roomIds = new ArrayList<>(loadCorridorRoomIds(conn, corridorId));
        if (!roomIds.contains(roomId)) {
            roomIds.add(roomId);
        }
        replaceCorridorRooms(conn, mapId, corridorId, roomIds);
    }

    public static void removeRoomFromCorridor(Connection conn, long mapId, long corridorId, long roomId) throws SQLException {
        List<Long> roomIds = new ArrayList<>(loadCorridorRoomIds(conn, corridorId));
        roomIds.removeIf(id -> Objects.equals(id, roomId));
        replaceCorridorRooms(conn, mapId, corridorId, roomIds);
    }

    static void deleteCorridorById(Connection conn, long corridorId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_corridors WHERE corridor_id=?")) {
            ps.setLong(1, corridorId);
            ps.executeUpdate();
        }
    }

    public static void deleteCorridor(Connection conn, long mapId, long corridorId) throws SQLException {
        DungeonPersistenceGuards.ensureCorridorBelongsToMap(conn, mapId, corridorId);
        deleteCorridorById(conn, corridorId);
    }

    public static void replaceCorridorDoorOverrides(
            Connection conn,
            long mapId,
            long corridorId,
            List<CorridorDoorOverride> doorOverrides
    ) throws SQLException {
        DungeonPersistenceGuards.ensureCorridorBelongsToMap(conn, mapId, corridorId);
        List<CorridorDoorOverride> items = DungeonPersistenceBatch.sanitizeList(doorOverrides);
        Set<Long> roomIds = items.stream().map(CorridorDoorOverride::roomId).collect(Collectors.toSet());
        Set<Long> clusterIds = items.stream().map(CorridorDoorOverride::clusterId).collect(Collectors.toSet());
        DungeonPersistenceGuards.ensureRoomsBelongToMap(conn, mapId, roomIds);
        DungeonPersistenceGuards.ensureClustersBelongToMap(conn, mapId, clusterIds);
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_corridor_door_overrides WHERE corridor_id=?")) {
            delete.setLong(1, corridorId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_corridor_door_overrides(corridor_id, room_id, cluster_id, relative_cell_x, relative_cell_y, edge_direction, sort_order)"
                        + " VALUES(?,?,?,?,?,?,?)")) {
            for (int i = 0; i < items.size(); i++) {
                CorridorDoorOverride override = items.get(i);
                insert.setLong(1, corridorId);
                insert.setLong(2, override.roomId());
                insert.setLong(3, override.clusterId());
                insert.setInt(4, override.relativeCell().x());
                insert.setInt(5, override.relativeCell().y());
                insert.setString(6, override.edgeDirection().name());
                insert.setInt(7, i);
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    public static void replaceCorridorWaypoints(
            Connection conn,
            long mapId,
            long corridorId,
            List<CorridorWaypoint> waypoints
    ) throws SQLException {
        DungeonPersistenceGuards.ensureCorridorBelongsToMap(conn, mapId, corridorId);
        List<CorridorWaypoint> items = DungeonPersistenceBatch.sanitizeList(waypoints);
        Set<Long> clusterIds = items.stream().map(CorridorWaypoint::clusterId).collect(Collectors.toSet());
        DungeonPersistenceGuards.ensureClustersBelongToMap(conn, mapId, clusterIds);
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_corridor_waypoints WHERE corridor_id=?")) {
            delete.setLong(1, corridorId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_corridor_waypoints(corridor_id, sort_order, cluster_id, relative_x, relative_y)"
                        + " VALUES(?,?,?,?,?)")) {
            for (int i = 0; i < items.size(); i++) {
                CorridorWaypoint waypoint = items.get(i);
                insert.setLong(1, corridorId);
                insert.setInt(2, i);
                insert.setLong(3, waypoint.clusterId());
                insert.setInt(4, waypoint.relativeCell().x());
                insert.setInt(5, waypoint.relativeCell().y());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    public static void deleteCorridorDoorOverride(Connection conn, long corridorId, long roomId) throws SQLException {
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_corridor_door_overrides WHERE corridor_id=? AND room_id=?")) {
            delete.setLong(1, corridorId);
            delete.setLong(2, roomId);
            delete.executeUpdate();
        }
    }

    private static List<Long> loadCorridorRoomIds(Connection conn, long corridorId) throws SQLException {
        List<Long> roomIds = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT room_id FROM dungeon_corridor_members WHERE corridor_id=? ORDER BY member_order, room_id")) {
            ps.setLong(1, corridorId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    roomIds.add(rs.getLong("room_id"));
                }
            }
        }
        return List.copyOf(roomIds);
    }

    private static List<Long> normalizeRoomIds(List<Long> roomIds) {
        LinkedHashSet<Long> uniqueIds = new LinkedHashSet<>();
        if (roomIds != null) {
            for (Long roomId : roomIds) {
                if (roomId != null) {
                    uniqueIds.add(roomId);
                }
            }
        }
        return List.copyOf(uniqueIds);
    }

    // --- Read support ---

    @FunctionalInterface
    private interface RowMapper<T> {
        T map(ResultSet rs) throws SQLException;
    }

    private static <K, V> Map<K, List<V>> loadGrouped(
            Connection conn, String sql, long param,
            RowMapper<K> keyExtractor, RowMapper<V> valueExtractor) throws SQLException {
        Map<K, List<V>> result = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, param);
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
        return result;
    }

    private record CorridorRow(long id, List<Long> memberRoomIds) {}

    public static List<DungeonCorridor> loadCorridors(Connection conn, long mapId) throws SQLException {
        Map<Long, CorridorRow> corridorRows = loadCorridorRows(conn, mapId);
        Map<Long, List<CorridorDoorOverride>> doorOverrides = loadDoorOverrides(conn, mapId);
        Map<Long, List<CorridorWaypoint>> waypoints = loadWaypoints(conn, mapId);

        List<DungeonCorridor> result = new ArrayList<>();
        for (CorridorRow row : corridorRows.values()) {
            result.add(new DungeonCorridor(
                    row.id(),
                    mapId,
                    row.memberRoomIds(),
                    doorOverrides.getOrDefault(row.id(), List.of()),
                    waypoints.getOrDefault(row.id(), List.of())));
        }
        return result;
    }

    private static Map<Long, CorridorRow> loadCorridorRows(Connection conn, long mapId) throws SQLException {
        Map<Long, List<Long>> membersByCorridorId = loadGrouped(conn,
                "SELECT c.corridor_id, m.room_id"
                        + " FROM dungeon_corridors c"
                        + " LEFT JOIN dungeon_corridor_members m ON m.corridor_id=c.corridor_id"
                        + " WHERE c.dungeon_map_id=?"
                        + " ORDER BY c.corridor_id, m.member_order, m.room_id",
                mapId,
                rs -> rs.getLong("corridor_id"),
                rs -> { long roomId = rs.getLong("room_id"); return rs.wasNull() ? null : roomId; });

        Map<Long, CorridorRow> result = new LinkedHashMap<>();
        for (Map.Entry<Long, List<Long>> e : membersByCorridorId.entrySet()) {
            result.put(e.getKey(), new CorridorRow(e.getKey(), e.getValue()));
        }
        return result;
    }

    private static Map<Long, List<CorridorDoorOverride>> loadDoorOverrides(Connection conn, long mapId) throws SQLException {
        return loadGrouped(conn,
                "SELECT corridor_id, room_id, cluster_id, relative_cell_x, relative_cell_y, edge_direction"
                        + " FROM dungeon_corridor_door_overrides"
                        + " WHERE corridor_id IN (SELECT corridor_id FROM dungeon_corridors WHERE dungeon_map_id=?)"
                        + " ORDER BY corridor_id, sort_order, room_id",
                mapId,
                rs -> rs.getLong("corridor_id"),
                rs -> new CorridorDoorOverride(
                        rs.getLong("room_id"),
                        rs.getLong("cluster_id"),
                        new Point2i(rs.getInt("relative_cell_x"), rs.getInt("relative_cell_y")),
                        DungeonRoomCluster.EdgeDirection.valueOf(rs.getString("edge_direction"))));
    }

    private static Map<Long, List<CorridorWaypoint>> loadWaypoints(Connection conn, long mapId) throws SQLException {
        return loadGrouped(conn,
                "SELECT corridor_id, cluster_id, relative_x, relative_y"
                        + " FROM dungeon_corridor_waypoints"
                        + " WHERE corridor_id IN (SELECT corridor_id FROM dungeon_corridors WHERE dungeon_map_id=?)"
                        + " ORDER BY corridor_id, sort_order",
                mapId,
                rs -> rs.getLong("corridor_id"),
                rs -> new CorridorWaypoint(
                        rs.getLong("cluster_id"),
                        new Point2i(rs.getInt("relative_x"), rs.getInt("relative_y"))));
    }
}
