package features.world.dungeonmap.persistence;

import features.world.dungeonmap.model.structures.traversal.TraversalDoorBinding;
import features.world.dungeonmap.model.structures.traversal.TraversalWaypointBinding;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.LinkedHashSet;
import java.util.List;

public final class DungeonTraversalWriteRepository {

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
                insert.setString(6, directionName(binding.direction()));
                insert.setInt(7, index);
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    public void deleteTraversal(Connection conn, long traversalId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_traversals WHERE traversal_id=?")) {
            ps.setLong(1, traversalId);
            ps.executeUpdate();
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
            default -> throw new IllegalArgumentException("Unbekannte Traversal-Tuerrichtung: " + direction);
        };
    }
}
