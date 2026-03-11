package features.world.dungeonmap.repository;

import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.model.DungeonSquarePaint;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public final class DungeonSquareRepository {

    private DungeonSquareRepository() {
        throw new AssertionError("No instances");
    }

    public static List<DungeonSquare> getSquares(Connection conn, long mapId) throws SQLException {
        List<DungeonSquare> result = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT s.square_id, s.map_id, s.x, s.y, s.room_id, "
                        + "r.name AS room_name, r.area_id, a.name AS area_name "
                        + "FROM dungeon_squares s "
                        + "LEFT JOIN dungeon_rooms r ON r.room_id = s.room_id "
                        + "LEFT JOIN dungeon_areas a ON a.area_id = r.area_id "
                        + "WHERE s.map_id=? ORDER BY s.y, s.x")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.add(mapSquare(rs));
                }
            }
        }
        return result;
    }

    public static void applySquarePaints(Connection conn, long mapId, List<DungeonSquarePaint> paints) throws SQLException {
        try (PreparedStatement upsert = conn.prepareStatement(
                "INSERT INTO dungeon_squares(map_id, x, y, room_id) VALUES(?,?,?,?) "
                        + "ON CONFLICT(map_id, x, y) DO UPDATE SET room_id=excluded.room_id");
             PreparedStatement delete = conn.prepareStatement(
                     "DELETE FROM dungeon_squares WHERE map_id=? AND x=? AND y=?")) {
            for (DungeonSquarePaint paint : paints) {
                if (paint.filled()) {
                    upsert.setLong(1, mapId);
                    upsert.setInt(2, paint.x());
                    upsert.setInt(3, paint.y());
                    if (paint.roomId() != null) {
                        upsert.setLong(4, paint.roomId());
                    } else {
                        upsert.setNull(4, java.sql.Types.INTEGER);
                    }
                    upsert.addBatch();
                } else {
                    delete.setLong(1, mapId);
                    delete.setInt(2, paint.x());
                    delete.setInt(3, paint.y());
                    delete.addBatch();
                }
            }
            upsert.executeBatch();
            delete.executeBatch();
        }
    }

    public static void assignSquareRoom(Connection conn, long squareId, Long roomId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_squares SET room_id=? WHERE square_id=?")) {
            if (roomId != null) {
                ps.setLong(1, roomId);
            } else {
                ps.setNull(1, java.sql.Types.INTEGER);
            }
            ps.setLong(2, squareId);
            ps.executeUpdate();
        }
    }

    private static DungeonSquare mapSquare(ResultSet rs) throws SQLException {
        return new DungeonSquare(
                rs.getLong("square_id"),
                rs.getLong("map_id"),
                rs.getInt("x"),
                rs.getInt("y"),
                getNullableLong(rs, "room_id"),
                rs.getString("room_name"),
                getNullableLong(rs, "area_id"),
                rs.getString("area_name"));
    }

    private static Long getNullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }
}
