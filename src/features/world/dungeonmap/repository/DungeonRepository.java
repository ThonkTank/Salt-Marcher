package features.world.dungeonmap.repository;

import features.world.dungeonmap.model.DungeonCorridor;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonRoomCluster;
import features.world.dungeonmap.model.Point2i;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

public final class DungeonRepository {

    private DungeonRepository() {
        throw new AssertionError("No instances");
    }

    public static Optional<Long> firstMapId(Connection conn) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT dungeon_map_id FROM dungeon_maps ORDER BY dungeon_map_id LIMIT 1");
             ResultSet rs = ps.executeQuery()) {
            if (rs.next()) {
                return Optional.of(rs.getLong(1));
            }
            return Optional.empty();
        }
    }

    public static List<DungeonMap> getAllMaps(Connection conn) throws SQLException {
        List<DungeonMap> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT dungeon_map_id, name FROM dungeon_maps ORDER BY dungeon_map_id");
             ResultSet rs = ps.executeQuery()) {
            while (rs.next()) {
                result.add(new DungeonMap(rs.getLong("dungeon_map_id"), rs.getString("name")));
            }
        }
        return result;
    }

    public static long insertMap(Connection conn, String name) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_maps(name) VALUES(?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setString(1, name);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (!rs.next()) {
                    throw new SQLException("No key returned for dungeon_maps insert");
                }
                return rs.getLong(1);
            }
        }
    }

    public static void updateMapName(Connection conn, long mapId, String name) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_maps SET name=? WHERE dungeon_map_id=?")) {
            ps.setString(1, name);
            ps.setLong(2, mapId);
            ps.executeUpdate();
        }
    }

    public static void deleteMap(Connection conn, long mapId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_maps WHERE dungeon_map_id=?")) {
            ps.setLong(1, mapId);
            ps.executeUpdate();
        }
    }

    public static Optional<DungeonLayout> loadLayout(Connection conn, long mapId) throws SQLException {
        DungeonMap map = null;
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT dungeon_map_id, name FROM dungeon_maps WHERE dungeon_map_id=?")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    map = new DungeonMap(rs.getLong("dungeon_map_id"), rs.getString("name"));
                }
            }
        }
        if (map == null) {
            return Optional.empty();
        }

        List<DungeonRoom> rooms = loadRooms(conn, mapId);
        List<DungeonCorridor> corridors = loadCorridors(conn, mapId);
        List<DungeonRoomCluster> clusters = loadClusters(conn, mapId);
        return Optional.of(new DungeonLayout(map, rooms, corridors, clusters));
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
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_room_cluster_edges WHERE cluster_id=?")) {
            delete.setLong(1, clusterId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_room_cluster_edges(cluster_id, cell_x, cell_y, edge_direction, edge_type) VALUES(?,?,?,?,?)")) {
            for (DungeonRoomCluster.EdgeOverride edge : edgeOverrides) {
                insert.setLong(1, clusterId);
                insert.setInt(2, edge.cell().x());
                insert.setInt(3, edge.cell().y());
                insert.setString(4, edge.direction().name());
                insert.setString(5, edge.type().name());
                insert.addBatch();
            }
            insert.executeBatch();
        }
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
        long roomId;
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
                roomId = rs.getLong(1);
            }
        }
        return roomId;
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

    public static void deleteRoom(Connection conn, long roomId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_rooms WHERE room_id=?")) {
            ps.setLong(1, roomId);
            ps.executeUpdate();
        }
    }

    public static void deleteRoom(Connection conn, long mapId, long roomId) throws SQLException {
        ensureRoomBelongsToMap(conn, mapId, roomId);
        deleteRoom(conn, roomId);
    }

    public static long insertCorridor(Connection conn, long mapId, List<Long> roomIds) throws SQLException {
        List<Long> normalizedRoomIds = normalizeRoomIds(roomIds);
        if (normalizedRoomIds.size() < 2) {
            throw new IllegalArgumentException("Korridorgruppe braucht mindestens zwei Räume");
        }
        for (Long roomId : normalizedRoomIds) {
            ensureRoomBelongsToMap(conn, mapId, roomId);
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
        ensureCorridorBelongsToMap(conn, mapId, corridorId);
        List<Long> normalizedRoomIds = normalizeRoomIds(roomIds);
        if (normalizedRoomIds.size() < 2) {
            deleteCorridor(conn, mapId, corridorId);
            return;
        }
        for (Long roomId : normalizedRoomIds) {
            ensureRoomBelongsToMap(conn, mapId, roomId);
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

    public static void deleteCorridor(Connection conn, long corridorId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_corridors WHERE corridor_id=?")) {
            ps.setLong(1, corridorId);
            ps.executeUpdate();
        }
    }

    public static void deleteCorridor(Connection conn, long mapId, long corridorId) throws SQLException {
        ensureCorridorBelongsToMap(conn, mapId, corridorId);
        deleteCorridor(conn, corridorId);
    }

    private static void ensureRoomBelongsToMap(Connection conn, long mapId, long roomId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT 1 FROM dungeon_rooms WHERE room_id=? AND dungeon_map_id=?")) {
            ps.setLong(1, roomId);
            ps.setLong(2, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return;
                }
            }
        }
        throw new SQLException("Raum " + roomId + " gehört nicht zu Dungeon-Map " + mapId);
    }

    private static void ensureCorridorBelongsToMap(Connection conn, long mapId, long corridorId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT 1 FROM dungeon_corridors WHERE corridor_id=? AND dungeon_map_id=?")) {
            ps.setLong(1, corridorId);
            ps.setLong(2, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return;
                }
            }
        }
        throw new SQLException("Korridor " + corridorId + " gehört nicht zu Dungeon-Map " + mapId);
    }

    private static List<DungeonRoom> loadRooms(Connection conn, long mapId) throws SQLException {
        List<DungeonRoom> rooms = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT room_id, dungeon_map_id, cluster_id, name, component_x, component_y FROM dungeon_rooms"
                        + " WHERE dungeon_map_id=? ORDER BY room_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long roomId = rs.getLong("room_id");
                    int componentX = rs.getInt("component_x");
                    int componentY = rs.getInt("component_y");
                    rooms.add(new DungeonRoom(
                            roomId,
                            rs.getLong("dungeon_map_id"),
                            rs.getLong("cluster_id"),
                            rs.getString("name"),
                            new Point2i(componentX, componentY)));
                }
            }
        }
        return rooms;
    }

    private static List<DungeonRoomCluster> loadClusters(Connection conn, long mapId) throws SQLException {
        Map<Long, List<Point2i>> verticesByClusterId = new HashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT cluster_id, relative_x, relative_y FROM dungeon_room_cluster_vertices"
                        + " WHERE cluster_id IN (SELECT cluster_id FROM dungeon_room_clusters WHERE dungeon_map_id=?)"
                        + " ORDER BY cluster_id, vertex_index")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long clusterId = rs.getLong("cluster_id");
                    verticesByClusterId.computeIfAbsent(clusterId, ignored -> new ArrayList<>())
                            .add(new Point2i(rs.getInt("relative_x"), rs.getInt("relative_y")));
                }
            }
        }

        Map<Long, List<DungeonRoomCluster.EdgeOverride>> edgesByClusterId = new HashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT cluster_id, cell_x, cell_y, edge_direction, edge_type FROM dungeon_room_cluster_edges"
                        + " WHERE cluster_id IN (SELECT cluster_id FROM dungeon_room_clusters WHERE dungeon_map_id=?)"
                        + " ORDER BY cluster_id, cell_y, cell_x, edge_direction")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long clusterId = rs.getLong("cluster_id");
                    edgesByClusterId.computeIfAbsent(clusterId, ignored -> new ArrayList<>())
                            .add(DungeonRoomCluster.EdgeOverride.of(
                                    new Point2i(rs.getInt("cell_x"), rs.getInt("cell_y")),
                                    DungeonRoomCluster.EdgeDirection.valueOf(rs.getString("edge_direction")),
                                    DungeonRoomCluster.EdgeType.valueOf(rs.getString("edge_type"))));
                }
            }
        }

        List<DungeonRoomCluster> clusters = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT cluster_id, dungeon_map_id, center_x, center_y FROM dungeon_room_clusters"
                        + " WHERE dungeon_map_id=? ORDER BY cluster_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long clusterId = rs.getLong("cluster_id");
                    clusters.add(new DungeonRoomCluster(
                            clusterId,
                            rs.getLong("dungeon_map_id"),
                            new Point2i(rs.getInt("center_x"), rs.getInt("center_y")),
                            List.copyOf(verticesByClusterId.getOrDefault(clusterId, List.of())),
                            List.copyOf(edgesByClusterId.getOrDefault(clusterId, List.of()))));
                }
            }
        }
        return clusters;
    }

    private static List<DungeonCorridor> loadCorridors(Connection conn, long mapId) throws SQLException {
        Map<Long, List<Long>> membersByCorridorId = new HashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT c.corridor_id, m.room_id"
                        + " FROM dungeon_corridors c"
                        + " LEFT JOIN dungeon_corridor_members m ON m.corridor_id=c.corridor_id"
                        + " WHERE c.dungeon_map_id=?"
                        + " ORDER BY c.corridor_id, m.member_order, m.room_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long corridorId = rs.getLong("corridor_id");
                    long roomId = rs.getLong("room_id");
                    if (!rs.wasNull()) {
                        membersByCorridorId.computeIfAbsent(corridorId, ignored -> new ArrayList<>()).add(roomId);
                    }
                }
            }
        }
        List<DungeonCorridor> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT corridor_id, dungeon_map_id FROM dungeon_corridors WHERE dungeon_map_id=? ORDER BY corridor_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long corridorId = rs.getLong("corridor_id");
                    result.add(new DungeonCorridor(
                            corridorId,
                            rs.getLong("dungeon_map_id"),
                            membersByCorridorId.getOrDefault(corridorId, List.of())));
                }
            }
        }
        return result;
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
        if (!roomIds.isEmpty()) {
            return List.copyOf(roomIds);
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT 1 FROM dungeon_corridors WHERE corridor_id=?")) {
            ps.setLong(1, corridorId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return List.of();
                }
            }
        }
        return List.of();
    }

    public static List<Long> normalizeRoomIds(List<Long> roomIds) {
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
