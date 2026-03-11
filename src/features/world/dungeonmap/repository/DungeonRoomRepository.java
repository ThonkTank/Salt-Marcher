package features.world.dungeonmap.repository;

import features.world.dungeonmap.model.DungeonRoom;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

public final class DungeonRoomRepository {

    private DungeonRoomRepository() {
        throw new AssertionError("No instances");
    }

    public static long upsertRoom(Connection conn, DungeonRoom room) throws SQLException {
        if (room.roomId() == null) {
            try (PreparedStatement ps = conn.prepareStatement(
                    "INSERT INTO dungeon_rooms(map_id, name, description, area_id) VALUES(?,?,?,?)",
                    Statement.RETURN_GENERATED_KEYS)) {
                ps.setLong(1, room.mapId());
                ps.setString(2, room.name());
                ps.setString(3, room.description());
                if (room.areaId() != null) {
                    ps.setLong(4, room.areaId());
                } else {
                    ps.setNull(4, java.sql.Types.INTEGER);
                }
                ps.executeUpdate();
                try (ResultSet keys = ps.getGeneratedKeys()) {
                    if (!keys.next()) {
                        throw new SQLException("No generated key returned for dungeon_rooms insert");
                    }
                    return keys.getLong(1);
                }
            }
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_rooms SET name=?, description=?, area_id=? WHERE room_id=?")) {
            ps.setString(1, room.name());
            ps.setString(2, room.description());
            if (room.areaId() != null) {
                ps.setLong(3, room.areaId());
            } else {
                ps.setNull(3, java.sql.Types.INTEGER);
            }
            ps.setLong(4, room.roomId());
            ps.executeUpdate();
            return room.roomId();
        }
    }

    public static List<DungeonRoom> getRooms(Connection conn, long mapId) throws SQLException {
        List<DungeonRoom> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT room_id, map_id, name, description, area_id FROM dungeon_rooms WHERE map_id=? ORDER BY room_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.add(new DungeonRoom(
                            rs.getLong("room_id"),
                            rs.getLong("map_id"),
                            rs.getString("name"),
                            rs.getString("description"),
                            getNullableLong(rs, "area_id")));
                }
            }
        }
        return result;
    }

    public static void deleteRoom(Connection conn, long roomId) throws SQLException {
        try (PreparedStatement clearSquares = conn.prepareStatement(
                "UPDATE dungeon_squares SET room_id=NULL WHERE room_id=?");
             PreparedStatement deleteRoom = conn.prepareStatement(
                     "DELETE FROM dungeon_rooms WHERE room_id=?")) {
            clearSquares.setLong(1, roomId);
            clearSquares.executeUpdate();
            deleteRoom.setLong(1, roomId);
            deleteRoom.executeUpdate();
        }
    }

    public static void assignRoomArea(Connection conn, long roomId, Long areaId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_rooms SET area_id=? WHERE room_id=?")) {
            if (areaId != null) {
                ps.setLong(1, areaId);
            } else {
                ps.setNull(1, java.sql.Types.INTEGER);
            }
            ps.setLong(2, roomId);
            ps.executeUpdate();
        }
    }

    private static Long getNullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }
}
