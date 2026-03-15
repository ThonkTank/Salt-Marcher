package features.world.dungeonmap.repository;

import features.world.dungeonmap.model.DungeonCorridor;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.Point2i;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public final class DungeonRepository {

    private DungeonRepository() {
        throw new AssertionError("No instances");
    }

    public static void createSchema(Statement stmt) throws SQLException {
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_maps ("
                + "dungeon_map_id INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "name           TEXT NOT NULL"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_rooms ("
                + "room_id         INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "dungeon_map_id  INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "name            TEXT NOT NULL,"
                + "center_x        INTEGER NOT NULL,"
                + "center_y        INTEGER NOT NULL"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_room_vertices ("
                + "room_id         INTEGER NOT NULL REFERENCES dungeon_rooms(room_id) ON DELETE CASCADE,"
                + "vertex_index    INTEGER NOT NULL,"
                + "relative_x      INTEGER NOT NULL,"
                + "relative_y      INTEGER NOT NULL,"
                + "PRIMARY KEY (room_id, vertex_index)"
                + ")");
        stmt.execute("CREATE TABLE IF NOT EXISTS dungeon_corridors ("
                + "corridor_id      INTEGER PRIMARY KEY AUTOINCREMENT,"
                + "dungeon_map_id   INTEGER NOT NULL REFERENCES dungeon_maps(dungeon_map_id) ON DELETE CASCADE,"
                + "from_room_id     INTEGER NOT NULL REFERENCES dungeon_rooms(room_id) ON DELETE CASCADE,"
                + "to_room_id       INTEGER NOT NULL REFERENCES dungeon_rooms(room_id) ON DELETE CASCADE,"
                + "UNIQUE (dungeon_map_id, from_room_id, to_room_id)"
                + ")");
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
        return Optional.of(new DungeonLayout(map, rooms, corridors));
    }

    public static long insertRoom(Connection conn, long mapId, String name, Point2i center, List<Point2i> vertices) throws SQLException {
        long roomId;
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_rooms(dungeon_map_id, name, center_x, center_y) VALUES(?,?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, mapId);
            ps.setString(2, name);
            ps.setInt(3, center.x());
            ps.setInt(4, center.y());
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (!rs.next()) {
                    throw new SQLException("No key returned for dungeon_rooms insert");
                }
                roomId = rs.getLong(1);
            }
        }
        replaceRoomVertices(conn, roomId, vertices);
        return roomId;
    }

    public static void updateRoom(Connection conn, long roomId, String name, Point2i center) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_rooms SET name=?, center_x=?, center_y=? WHERE room_id=?")) {
            ps.setString(1, name);
            ps.setInt(2, center.x());
            ps.setInt(3, center.y());
            ps.setLong(4, roomId);
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

    public static long insertCorridor(Connection conn, long mapId, long fromRoomId, long toRoomId) throws SQLException {
        long normalizedFrom = Math.min(fromRoomId, toRoomId);
        long normalizedTo = Math.max(fromRoomId, toRoomId);
        ensureRoomBelongsToMap(conn, mapId, normalizedFrom);
        ensureRoomBelongsToMap(conn, mapId, normalizedTo);
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT OR IGNORE INTO dungeon_corridors(dungeon_map_id, from_room_id, to_room_id) VALUES(?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, mapId);
            ps.setLong(2, normalizedFrom);
            ps.setLong(3, normalizedTo);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (rs.next()) {
                    return rs.getLong(1);
                }
            }
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT corridor_id FROM dungeon_corridors WHERE dungeon_map_id=? AND from_room_id=? AND to_room_id=?")) {
            ps.setLong(1, mapId);
            ps.setLong(2, normalizedFrom);
            ps.setLong(3, normalizedTo);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return rs.getLong(1);
                }
            }
        }
        throw new SQLException("Failed to resolve dungeon_corridors row");
    }

    public static void deleteCorridor(Connection conn, long corridorId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_corridors WHERE corridor_id=?")) {
            ps.setLong(1, corridorId);
            ps.executeUpdate();
        }
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

    private static List<DungeonRoom> loadRooms(Connection conn, long mapId) throws SQLException {
        Map<Long, List<Point2i>> verticesByRoomId = new HashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT room_id, relative_x, relative_y FROM dungeon_room_vertices"
                        + " WHERE room_id IN (SELECT room_id FROM dungeon_rooms WHERE dungeon_map_id=?)"
                        + " ORDER BY room_id, vertex_index")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long roomId = rs.getLong("room_id");
                    verticesByRoomId.computeIfAbsent(roomId, ignored -> new ArrayList<>())
                            .add(new Point2i(rs.getInt("relative_x"), rs.getInt("relative_y")));
                }
            }
        }

        List<DungeonRoom> rooms = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT room_id, dungeon_map_id, name, center_x, center_y FROM dungeon_rooms"
                        + " WHERE dungeon_map_id=? ORDER BY room_id");
             ) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long roomId = rs.getLong("room_id");
                    rooms.add(new DungeonRoom(
                            roomId,
                            rs.getLong("dungeon_map_id"),
                            rs.getString("name"),
                            new Point2i(rs.getInt("center_x"), rs.getInt("center_y")),
                            List.copyOf(verticesByRoomId.getOrDefault(roomId, List.of()))));
                }
            }
        }
        return rooms;
    }

    private static List<DungeonCorridor> loadCorridors(Connection conn, long mapId) throws SQLException {
        List<DungeonCorridor> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT corridor_id, dungeon_map_id, from_room_id, to_room_id"
                        + " FROM dungeon_corridors WHERE dungeon_map_id=? ORDER BY corridor_id");
             ) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.add(new DungeonCorridor(
                            rs.getLong("corridor_id"),
                            rs.getLong("dungeon_map_id"),
                            rs.getLong("from_room_id"),
                            rs.getLong("to_room_id")));
                }
            }
        }
        return result;
    }

    private static void replaceRoomVertices(Connection conn, long roomId, List<Point2i> vertices) throws SQLException {
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_room_vertices WHERE room_id=?")) {
            delete.setLong(1, roomId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_room_vertices(room_id, vertex_index, relative_x, relative_y) VALUES(?,?,?,?)")) {
            for (int i = 0; i < vertices.size(); i++) {
                Point2i vertex = vertices.get(i);
                insert.setLong(1, roomId);
                insert.setInt(2, i);
                insert.setInt(3, vertex.x());
                insert.setInt(4, vertex.y());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }
}
