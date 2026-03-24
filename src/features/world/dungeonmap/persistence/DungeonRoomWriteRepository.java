package features.world.dungeonmap.persistence;

import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.room.RoomExitNarration;
import features.world.dungeonmap.model.structures.room.RoomNarration;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;

public final class DungeonRoomWriteRepository {

    public long insertCluster(Connection conn, long mapId, ClusterGeometryWrite geometry) throws SQLException {
        return insertCluster(conn, mapId, geometry, 0);
    }

    public long insertCluster(Connection conn, long mapId, ClusterGeometryWrite geometry, int levelZ) throws SQLException {
        long clusterId;
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_room_clusters(dungeon_map_id, center_x, center_y, level_z) VALUES(?,?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, mapId);
            ps.setInt(2, geometry.center().x());
            ps.setInt(3, geometry.center().y());
            ps.setInt(4, levelZ);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (!rs.next()) {
                    throw new SQLException("No key returned for dungeon_room_clusters insert");
                }
                clusterId = rs.getLong(1);
            }
        }
        replaceClusterVertices(conn, clusterId, geometry.relativeVertices());
        return clusterId;
    }

    public void updateClusterGeometry(Connection conn, long clusterId, ClusterGeometryWrite geometry) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_room_clusters SET center_x=?, center_y=? WHERE cluster_id=?")) {
            ps.setInt(1, geometry.center().x());
            ps.setInt(2, geometry.center().y());
            ps.setLong(3, clusterId);
            ps.executeUpdate();
        }
        replaceClusterVertices(conn, clusterId, geometry.relativeVertices());
    }

    public void deleteCluster(Connection conn, long clusterId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_room_clusters WHERE cluster_id=?")) {
            ps.setLong(1, clusterId);
            ps.executeUpdate();
        }
    }

    public void replaceClusterEdges(
            Connection conn,
            long clusterId,
            Point2i clusterCenter,
            List<ClusterBoundaryWrite> boundaries
    ) throws SQLException {
        List<ClusterBoundaryWrite> sanitized = boundaries == null ? List.of() : boundaries.stream()
                .filter(java.util.Objects::nonNull)
                .toList();
        Point2i resolvedCenter = clusterCenter == null ? new Point2i(0, 0) : clusterCenter;
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_room_cluster_edges WHERE cluster_id=?")) {
            delete.setLong(1, clusterId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_room_cluster_edges(cluster_id, cell_x, cell_y, edge_direction, edge_type) VALUES(?,?,?,?,?)")) {
            for (ClusterBoundaryWrite boundary : sanitized) {
                insert.setLong(1, clusterId);
                Point2i relativeCell = boundary.cell().subtract(resolvedCenter);
                insert.setInt(2, relativeCell.x());
                insert.setInt(3, relativeCell.y());
                insert.setString(4, directionName(boundary.direction()));
                insert.setString(5, boundary.type().name());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    public long insertRoom(Connection conn, long mapId, long clusterId, String name, Point2i anchor) throws SQLException {
        return insertRoom(conn, mapId, clusterId, name, anchor, 0);
    }

    public long insertRoom(Connection conn, long mapId, long clusterId, String name, Point2i anchor, int levelZ) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_rooms(dungeon_map_id, cluster_id, name, component_x, component_y, level_z) VALUES(?,?,?,?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, mapId);
            ps.setLong(2, clusterId);
            ps.setString(3, name);
            ps.setInt(4, anchor.x());
            ps.setInt(5, anchor.y());
            ps.setInt(6, levelZ);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (!rs.next()) {
                    throw new SQLException("No key returned for dungeon_rooms insert");
                }
                return rs.getLong(1);
            }
        }
    }

    public void updateRoomPosition(Connection conn, long roomId, Point2i anchor) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_rooms SET component_x=?, component_y=? WHERE room_id=?")) {
            ps.setInt(1, anchor.x());
            ps.setInt(2, anchor.y());
            ps.setLong(3, roomId);
            ps.executeUpdate();
        }
    }

    public void updateRoom(Connection conn, long roomId, String name, Point2i anchor) throws SQLException {
        updateRoom(conn, roomId, name, anchor, 0);
    }

    public void updateRoom(Connection conn, long roomId, String name, Point2i anchor, int levelZ) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_rooms SET name=?, component_x=?, component_y=?, level_z=? WHERE room_id=?")) {
            ps.setString(1, name);
            ps.setInt(2, anchor.x());
            ps.setInt(3, anchor.y());
            ps.setInt(4, levelZ);
            ps.setLong(5, roomId);
            ps.executeUpdate();
        }
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
                "INSERT INTO dungeon_room_exit_descriptions(room_id, cell_x, cell_y, edge_direction, description, sort_order)"
                        + " VALUES(?,?,?,?,?,?)")) {
            int sortOrder = 0;
            for (RoomExitNarration exitNarration : resolvedNarration.exitNarrations()) {
                insert.setLong(1, roomId);
                insert.setInt(2, exitNarration.roomCell().x());
                insert.setInt(3, exitNarration.roomCell().y());
                insert.setString(4, directionName(exitNarration.direction()));
                insert.setString(5, exitNarration.description());
                insert.setInt(6, sortOrder++);
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    public void reassignRoomCluster(Connection conn, long roomId, long clusterId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_rooms SET cluster_id=? WHERE room_id=?")) {
            ps.setLong(1, clusterId);
            ps.setLong(2, roomId);
            ps.executeUpdate();
        }
    }

    public void deleteRoom(Connection conn, long roomId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_rooms WHERE room_id=?")) {
            ps.setLong(1, roomId);
            ps.executeUpdate();
        }
    }

    private void replaceClusterVertices(Connection conn, long clusterId, List<Point2i> relativeVertices) throws SQLException {
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_room_cluster_vertices WHERE cluster_id=?")) {
            delete.setLong(1, clusterId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_room_cluster_vertices(cluster_id, vertex_index, relative_x, relative_y) VALUES(?,?,?,?)")) {
            for (int i = 0; i < relativeVertices.size(); i++) {
                Point2i vertex = relativeVertices.get(i);
                insert.setLong(1, clusterId);
                insert.setInt(2, i);
                insert.setInt(3, vertex.x());
                insert.setInt(4, vertex.y());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static String directionName(Point2i direction) {
        return switch (direction.x() + "," + direction.y()) {
            case "0,-1" -> "NORTH";
            case "1,0" -> "EAST";
            case "0,1" -> "SOUTH";
            case "-1,0" -> "WEST";
            default -> throw new IllegalArgumentException("Unbekannte Kantenrichtung: " + direction);
        };
    }
}
