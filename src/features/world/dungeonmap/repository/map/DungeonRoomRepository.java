package features.world.dungeonmap.repository.map;

import features.world.dungeonmap.model.domain.DungeonRoom;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class DungeonRoomRepository {

    private DungeonRoomRepository() {
        throw new AssertionError("No instances");
    }

    public static long upsertRoom(Connection conn, DungeonRoom room) throws SQLException {
        if (room.roomId() == null) {
            try (PreparedStatement ps = conn.prepareStatement(
                    "INSERT INTO dungeon_rooms(map_id, name, glance_description, detail_description, reactive_checks, gm_background, area_id) "
                            + "VALUES(?,?,?,?,?,?,?)",
                    Statement.RETURN_GENERATED_KEYS)) {
                ps.setLong(1, room.mapId());
                ps.setString(2, room.name());
                ps.setString(3, room.glanceDescription());
                ps.setString(4, room.detailDescription());
                ps.setString(5, room.reactiveChecks());
                ps.setString(6, room.gmBackground());
                if (room.areaId() != null) {
                    ps.setLong(7, room.areaId());
                } else {
                    ps.setNull(7, java.sql.Types.INTEGER);
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
                "UPDATE dungeon_rooms "
                        + "SET name=?, glance_description=?, detail_description=?, reactive_checks=?, gm_background=?, area_id=? "
                        + "WHERE room_id=?")) {
            ps.setString(1, room.name());
            ps.setString(2, room.glanceDescription());
            ps.setString(3, room.detailDescription());
            ps.setString(4, room.reactiveChecks());
            ps.setString(5, room.gmBackground());
            if (room.areaId() != null) {
                ps.setLong(6, room.areaId());
            } else {
                ps.setNull(6, java.sql.Types.INTEGER);
            }
            ps.setLong(7, room.roomId());
            ps.executeUpdate();
            return room.roomId();
        }
    }

    public static List<DungeonRoom> getRooms(Connection conn, long mapId) throws SQLException {
        List<DungeonRoom> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT room_id, map_id, name, glance_description, detail_description, reactive_checks, gm_background, area_id "
                        + "FROM dungeon_rooms WHERE map_id=? ORDER BY room_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.add(new DungeonRoom(
                            rs.getLong("room_id"),
                            rs.getLong("map_id"),
                            rs.getString("name"),
                            rs.getString("glance_description"),
                            rs.getString("detail_description"),
                            rs.getString("reactive_checks"),
                            rs.getString("gm_background"),
                            getNullableLong(rs, "area_id")));
                }
            }
        }
        return result;
    }

    public static Optional<DungeonRoom> findRoom(Connection conn, long roomId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT room_id, map_id, name, glance_description, detail_description, reactive_checks, gm_background, area_id "
                        + "FROM dungeon_rooms WHERE room_id=?")) {
            ps.setLong(1, roomId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return Optional.empty();
                }
                return Optional.of(new DungeonRoom(
                        rs.getLong("room_id"),
                        rs.getLong("map_id"),
                        rs.getString("name"),
                        rs.getString("glance_description"),
                        rs.getString("detail_description"),
                        rs.getString("reactive_checks"),
                        rs.getString("gm_background"),
                        getNullableLong(rs, "area_id")));
            }
        }
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

    public static void assignRoomArea(Connection conn, long roomId, long areaId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_rooms SET area_id=? WHERE room_id=?")) {
            ps.setLong(1, areaId);
            ps.setLong(2, roomId);
            ps.executeUpdate();
        }
    }

    public static void updateRoomMetadata(
            Connection conn,
            long roomId,
            String name,
            String glanceDescription,
            String detailDescription,
            String reactiveChecks,
            String gmBackground
    ) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_rooms "
                        + "SET name=?, glance_description=?, detail_description=?, reactive_checks=?, gm_background=? "
                        + "WHERE room_id=?")) {
            ps.setString(1, name);
            ps.setString(2, glanceDescription);
            ps.setString(3, detailDescription);
            ps.setString(4, reactiveChecks);
            ps.setString(5, gmBackground);
            ps.setLong(6, roomId);
            ps.executeUpdate();
        }
    }

    private static Long getNullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }
}
