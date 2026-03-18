package features.world.dungeonmap.corridors.persistence;

import features.world.dungeonmap.corridors.model.CorridorDoorOverride;
import features.world.dungeonmap.corridors.model.CorridorWaypoint;
import features.world.dungeonmap.foundation.db.DungeonPersistenceBatch;
import features.world.dungeonmap.foundation.db.DungeonPersistenceGuards;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

public final class DungeonCorridorPersistenceRepository {

    private DungeonCorridorPersistenceRepository() {
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
}
