package features.world.dungeonmap.rooms.persistence;

import features.world.dungeonmap.foundation.db.DungeonPersistenceBatch;
import features.world.dungeonmap.foundation.db.DungeonPersistenceGuards;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.foundation.geometry.Point2i;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;

public final class DungeonRoomPersistenceRepository {

    private DungeonRoomPersistenceRepository() {
    }

    public static long insertCluster(Connection conn, long mapId, Point2i center, List<Point2i> vertices) throws SQLException {
        long clusterId;
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_room_clusters(dungeon_map_id, center_x, center_y) VALUES(?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, mapId);
            ps.setInt(2, center.x());
            ps.setInt(3, center.y());
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (!rs.next()) {
                    throw new SQLException("No key returned for dungeon_room_clusters insert");
                }
                clusterId = rs.getLong(1);
            }
        }
        replaceClusterVertices(conn, clusterId, vertices);
        return clusterId;
    }

    public static void updateClusterGeometry(Connection conn, long clusterId, Point2i center, List<Point2i> vertices) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_room_clusters SET center_x=?, center_y=? WHERE cluster_id=?")) {
            ps.setInt(1, center.x());
            ps.setInt(2, center.y());
            ps.setLong(3, clusterId);
            ps.executeUpdate();
        }
        replaceClusterVertices(conn, clusterId, vertices);
    }

    public static void replaceClusterEdges(
            Connection conn,
            long clusterId,
            List<DungeonRoomCluster.EdgeOverride> edgeOverrides
    ) throws SQLException {
        DungeonPersistenceBatch.batchReplace(
                conn,
                "DELETE FROM dungeon_room_cluster_edges WHERE cluster_id=?",
                clusterId,
                "INSERT INTO dungeon_room_cluster_edges(cluster_id, cell_x, cell_y, edge_direction, edge_type) VALUES(?,?,?,?,?)",
                edgeOverrides,
                (ps, edge) -> {
                    ps.setLong(1, clusterId);
                    ps.setInt(2, edge.cell().x());
                    ps.setInt(3, edge.cell().y());
                    ps.setString(4, edge.direction().name());
                    ps.setString(5, edge.type().name());
                });
    }

    public static void deleteCluster(Connection conn, long clusterId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_room_clusters WHERE cluster_id=?")) {
            ps.setLong(1, clusterId);
            ps.executeUpdate();
        }
    }

    public static long insertRoom(
            Connection conn,
            long mapId,
            long clusterId,
            String name,
            Point2i componentAnchor
    ) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_rooms(dungeon_map_id, cluster_id, name, component_x, component_y) VALUES(?,?,?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, mapId);
            ps.setLong(2, clusterId);
            ps.setString(3, name);
            ps.setInt(4, componentAnchor.x());
            ps.setInt(5, componentAnchor.y());
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (!rs.next()) {
                    throw new SQLException("No key returned for dungeon_rooms insert");
                }
                return rs.getLong(1);
            }
        }
    }

    public static void updateRoomPosition(Connection conn, long roomId, Point2i componentAnchor) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_rooms SET component_x=?, component_y=? WHERE room_id=?")) {
            ps.setInt(1, componentAnchor.x());
            ps.setInt(2, componentAnchor.y());
            ps.setLong(3, roomId);
            ps.executeUpdate();
        }
    }

    public static void updateRoom(Connection conn, long roomId, String name, Point2i componentAnchor) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_rooms SET name=?, component_x=?, component_y=? WHERE room_id=?")) {
            ps.setString(1, name);
            ps.setInt(2, componentAnchor.x());
            ps.setInt(3, componentAnchor.y());
            ps.setLong(4, roomId);
            ps.executeUpdate();
        }
    }

    public static void reassignRoomCluster(Connection conn, long roomId, long clusterId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_rooms SET cluster_id=? WHERE room_id=?")) {
            ps.setLong(1, clusterId);
            ps.setLong(2, roomId);
            ps.executeUpdate();
        }
    }

    static void deleteRoomById(Connection conn, long roomId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_rooms WHERE room_id=?")) {
            ps.setLong(1, roomId);
            ps.executeUpdate();
        }
    }

    public static void deleteRoom(Connection conn, long mapId, long roomId) throws SQLException {
        DungeonPersistenceGuards.ensureRoomBelongsToMap(conn, mapId, roomId);
        deleteRoomById(conn, roomId);
    }

    private static void replaceClusterVertices(Connection conn, long clusterId, List<Point2i> vertices) throws SQLException {
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_room_cluster_vertices WHERE cluster_id=?")) {
            delete.setLong(1, clusterId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_room_cluster_vertices(cluster_id, vertex_index, relative_x, relative_y) VALUES(?,?,?,?)")) {
            for (int i = 0; i < vertices.size(); i++) {
                Point2i vertex = vertices.get(i);
                insert.setLong(1, clusterId);
                insert.setInt(2, i);
                insert.setInt(3, vertex.x());
                insert.setInt(4, vertex.y());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }
}
