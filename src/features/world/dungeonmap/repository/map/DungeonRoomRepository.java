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
                    "INSERT INTO dungeon_rooms(map_id, name, light_level, visual_description, sounds_description, "
                            + "smells_description, other_description, glance_description, detail_description, "
                            + "reactive_checks, gm_background, area_id, concept_level_id) "
                            + "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    Statement.RETURN_GENERATED_KEYS)) {
                ps.setLong(1, room.mapId());
                ps.setString(2, room.name());
                ps.setString(3, room.lightLevel());
                ps.setString(4, room.visualDescription());
                ps.setString(5, room.soundsDescription());
                ps.setString(6, room.smellsDescription());
                ps.setString(7, room.otherDescription());
                ps.setString(8, room.glanceDescription());
                ps.setString(9, room.detailDescription());
                ps.setString(10, room.reactiveChecks());
                ps.setString(11, room.gmBackground());
                if (room.areaId() != null) {
                    ps.setLong(12, room.areaId());
                } else {
                    ps.setNull(12, java.sql.Types.INTEGER);
                }
                if (room.conceptLevelId() != null) {
                    ps.setLong(13, room.conceptLevelId());
                } else {
                    ps.setNull(13, java.sql.Types.INTEGER);
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
                        + "SET name=?, light_level=?, visual_description=?, sounds_description=?, smells_description=?, "
                        + "other_description=?, glance_description=?, detail_description=?, reactive_checks=?, "
                        + "gm_background=?, area_id=?, concept_level_id=? "
                        + "WHERE room_id=?")) {
            ps.setString(1, room.name());
            ps.setString(2, room.lightLevel());
            ps.setString(3, room.visualDescription());
            ps.setString(4, room.soundsDescription());
            ps.setString(5, room.smellsDescription());
            ps.setString(6, room.otherDescription());
            ps.setString(7, room.glanceDescription());
            ps.setString(8, room.detailDescription());
            ps.setString(9, room.reactiveChecks());
            ps.setString(10, room.gmBackground());
            if (room.areaId() != null) {
                ps.setLong(11, room.areaId());
            } else {
                ps.setNull(11, java.sql.Types.INTEGER);
            }
            if (room.conceptLevelId() != null) {
                ps.setLong(12, room.conceptLevelId());
            } else {
                ps.setNull(12, java.sql.Types.INTEGER);
            }
            ps.setLong(13, room.roomId());
            ps.executeUpdate();
            return room.roomId();
        }
    }

    public static List<DungeonRoom> getRooms(Connection conn, long mapId) throws SQLException {
        List<DungeonRoom> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT room_id, map_id, name, light_level, visual_description, sounds_description, smells_description, "
                        + "other_description, glance_description, detail_description, reactive_checks, gm_background, area_id, concept_level_id "
                        + "FROM dungeon_rooms WHERE map_id=? ORDER BY room_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.add(new DungeonRoom(
                            rs.getLong("room_id"),
                            rs.getLong("map_id"),
                            rs.getString("name"),
                            rs.getString("light_level"),
                            rs.getString("visual_description"),
                            rs.getString("sounds_description"),
                            rs.getString("smells_description"),
                            rs.getString("other_description"),
                            rs.getString("glance_description"),
                            rs.getString("detail_description"),
                            rs.getString("reactive_checks"),
                            rs.getString("gm_background"),
                            getNullableLong(rs, "area_id"),
                            getNullableLong(rs, "concept_level_id")));
                }
            }
        }
        return result;
    }

    public static Optional<DungeonRoom> findRoom(Connection conn, long roomId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT room_id, map_id, name, light_level, visual_description, sounds_description, smells_description, "
                        + "other_description, glance_description, detail_description, reactive_checks, gm_background, area_id, concept_level_id "
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
                        rs.getString("light_level"),
                        rs.getString("visual_description"),
                        rs.getString("sounds_description"),
                        rs.getString("smells_description"),
                        rs.getString("other_description"),
                        rs.getString("glance_description"),
                        rs.getString("detail_description"),
                        rs.getString("reactive_checks"),
                        rs.getString("gm_background"),
                        getNullableLong(rs, "area_id"),
                        getNullableLong(rs, "concept_level_id")));
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
            String lightLevel,
            String visualDescription,
            String soundsDescription,
            String smellsDescription,
            String otherDescription,
            String glanceDescription,
            String detailDescription,
            String reactiveChecks,
            String gmBackground
    ) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_rooms "
                        + "SET name=?, light_level=?, visual_description=?, sounds_description=?, smells_description=?, "
                        + "other_description=?, glance_description=?, detail_description=?, reactive_checks=?, gm_background=? "
                        + "WHERE room_id=?")) {
            ps.setString(1, name);
            ps.setString(2, lightLevel);
            ps.setString(3, visualDescription);
            ps.setString(4, soundsDescription);
            ps.setString(5, smellsDescription);
            ps.setString(6, otherDescription);
            ps.setString(7, glanceDescription);
            ps.setString(8, detailDescription);
            ps.setString(9, reactiveChecks);
            ps.setString(10, gmBackground);
            ps.setLong(11, roomId);
            ps.executeUpdate();
        }
    }

    private static Long getNullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }
}
