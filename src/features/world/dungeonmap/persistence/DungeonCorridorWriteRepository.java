package features.world.dungeonmap.persistence;

import features.world.dungeonmap.model.structures.corridor.CorridorDoorBinding;
import features.world.dungeonmap.model.structures.corridor.CorridorWaypointBinding;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

public final class DungeonCorridorWriteRepository {

    public long insertTraversalCorridor(Connection conn, long mapId, long traversalId) throws SQLException {
        return insertTraversalCorridor(conn, mapId, traversalId, null);
    }

    public long insertTraversalCorridor(Connection conn, long mapId, long traversalId, String segmentKey) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_corridors(dungeon_map_id, traversal_id, segment_key) VALUES(?, ?, ?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, mapId);
            ps.setLong(2, traversalId);
            ps.setString(3, segmentKey);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (!rs.next()) {
                    throw new SQLException("No key returned for dungeon_corridors insert");
                }
                return rs.getLong(1);
            }
        }
    }

    public void updateTraversalCorridorSegmentKey(Connection conn, long corridorId, String segmentKey) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_corridors SET segment_key=? WHERE corridor_id=?")) {
            ps.setString(1, segmentKey);
            ps.setLong(2, corridorId);
            ps.executeUpdate();
        }
    }

    public void deleteByTraversalId(Connection conn, long traversalId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_corridors WHERE traversal_id=?")) {
            ps.setLong(1, traversalId);
            ps.executeUpdate();
        }
    }

    public long insertCorridor(Connection conn, long mapId, List<Long> roomIds) throws SQLException {
        List<Long> normalizedRoomIds = normalizeRoomIds(roomIds);
        if (normalizedRoomIds.size() < 2) {
            throw new IllegalArgumentException("Korridorgruppe braucht mindestens zwei Räume");
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_corridors(dungeon_map_id) VALUES(?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, mapId);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (!rs.next()) {
                    throw new SQLException("No key returned for dungeon_corridors insert");
                }
                long corridorId = rs.getLong(1);
                replaceCorridorRooms(conn, corridorId, normalizedRoomIds);
                return corridorId;
            }
        }
    }

    public void replaceCorridorRooms(Connection conn, long corridorId, List<Long> roomIds) throws SQLException {
        List<Long> normalizedRoomIds = normalizeRoomIds(roomIds);
        if (normalizedRoomIds.size() < 2) {
            deleteCorridor(conn, corridorId);
            return;
        }
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_corridor_members WHERE corridor_id=?")) {
            delete.setLong(1, corridorId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_corridor_members(corridor_id, room_id, member_order) VALUES(?,?,?)")) {
            for (int index = 0; index < normalizedRoomIds.size(); index++) {
                insert.setLong(1, corridorId);
                insert.setLong(2, normalizedRoomIds.get(index));
                insert.setInt(3, index);
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    public void deleteCorridor(Connection conn, long corridorId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_corridors WHERE corridor_id=?")) {
            ps.setLong(1, corridorId);
            ps.executeUpdate();
        }
    }

    public void replaceCorridorWaypoints(Connection conn, long corridorId, List<CorridorWaypointBinding> waypoints) throws SQLException {
        List<CorridorWaypointBinding> sanitized = waypoints == null ? List.of() : waypoints.stream()
                .filter(java.util.Objects::nonNull)
                .toList();
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_corridor_waypoints WHERE corridor_id=?")) {
            delete.setLong(1, corridorId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_corridor_waypoints(corridor_id, sort_order, cluster_id, relative_x, relative_y, relative_z) VALUES(?,?,?,?,?,?)")) {
            for (int index = 0; index < sanitized.size(); index++) {
                CorridorWaypointBinding waypoint = sanitized.get(index);
                insert.setLong(1, corridorId);
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

    public void replaceCorridorDoorBindings(Connection conn, long corridorId, List<CorridorDoorBinding> doorBindings) throws SQLException {
        List<CorridorDoorBinding> sanitized = doorBindings == null ? List.of() : doorBindings.stream()
                .filter(java.util.Objects::nonNull)
                .toList();
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_corridor_door_overrides WHERE corridor_id=?")) {
            delete.setLong(1, corridorId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_corridor_door_overrides(corridor_id, room_id, cluster_id, relative_cell_x, relative_cell_y, edge_direction, sort_order) VALUES(?,?,?,?,?,?,?)")) {
            for (int index = 0; index < sanitized.size(); index++) {
                CorridorDoorBinding binding = sanitized.get(index);
                insert.setLong(1, corridorId);
                insert.setLong(2, binding.roomId());
                insert.setLong(3, binding.clusterId());
                insert.setInt(4, binding.relativeCell().x());
                insert.setInt(5, binding.relativeCell().y());
                insert.setString(6, directionName(binding.direction()));
                insert.setInt(7, index);
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    public void deleteDoorBinding(Connection conn, long corridorId, long roomId) throws SQLException {
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_corridor_door_overrides WHERE corridor_id=? AND room_id=?")) {
            delete.setLong(1, corridorId);
            delete.setLong(2, roomId);
            delete.executeUpdate();
        }
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

    private static String directionName(features.world.dungeonmap.model.geometry.Point2i direction) {
        return switch (direction.x() + "," + direction.y()) {
            case "0,-1" -> "NORTH";
            case "1,0" -> "EAST";
            case "0,1" -> "SOUTH";
            case "-1,0" -> "WEST";
            default -> throw new IllegalArgumentException("Unbekannte Korridor-Tuerrichtung: " + direction);
        };
    }
}
