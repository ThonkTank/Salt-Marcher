package features.world.dungeonmap.repository;

import features.world.dungeonmap.model.DungeonWall;
import features.world.dungeonmap.model.DungeonWallEdit;
import features.world.dungeonmap.model.PassageDirection;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public final class DungeonWallRepository {

    private DungeonWallRepository() {
        throw new AssertionError("No instances");
    }

    public static List<DungeonWall> getWalls(Connection conn, long mapId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT wall_id, map_id, x, y, direction FROM dungeon_walls WHERE map_id=? ORDER BY wall_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                List<DungeonWall> result = new ArrayList<>();
                while (rs.next()) {
                    result.add(mapRow(rs));
                }
                return result;
            }
        }
    }

    public static void applyWallEdits(Connection conn, long mapId, List<DungeonWallEdit> edits) throws SQLException {
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_walls(map_id, x, y, direction) VALUES(?,?,?,?) "
                        + "ON CONFLICT(map_id, x, y, direction) DO NOTHING");
             PreparedStatement delete = conn.prepareStatement(
                     "DELETE FROM dungeon_walls WHERE map_id=? AND x=? AND y=? AND direction=?")) {
            for (DungeonWallEdit edit : edits) {
                PreparedStatement target = edit.wallPresent() ? insert : delete;
                target.setLong(1, mapId);
                target.setInt(2, edit.x());
                target.setInt(3, edit.y());
                target.setString(4, edit.direction().dbValue());
                target.executeUpdate();
            }
        }
    }

    public static void deleteInvalidWalls(Connection conn, long mapId) throws SQLException {
        String sql = "DELETE FROM dungeon_walls "
                + "WHERE map_id=? AND ("
                + "(direction='east' AND ("
                + "NOT EXISTS (SELECT 1 FROM dungeon_squares a WHERE a.map_id=dungeon_walls.map_id AND a.x=dungeon_walls.x AND a.y=dungeon_walls.y)"
                + " OR NOT EXISTS (SELECT 1 FROM dungeon_squares b WHERE b.map_id=dungeon_walls.map_id AND b.x=dungeon_walls.x + 1 AND b.y=dungeon_walls.y)"
                + "))"
                + " OR "
                + "(direction='south' AND ("
                + "NOT EXISTS (SELECT 1 FROM dungeon_squares a WHERE a.map_id=dungeon_walls.map_id AND a.x=dungeon_walls.x AND a.y=dungeon_walls.y)"
                + " OR NOT EXISTS (SELECT 1 FROM dungeon_squares b WHERE b.map_id=dungeon_walls.map_id AND b.x=dungeon_walls.x AND b.y=dungeon_walls.y + 1)"
                + ")))";
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, mapId);
            ps.executeUpdate();
        }
    }

    private static DungeonWall mapRow(ResultSet rs) throws SQLException {
        return new DungeonWall(
                rs.getLong("wall_id"),
                rs.getLong("map_id"),
                rs.getInt("x"),
                rs.getInt("y"),
                PassageDirection.fromDb(rs.getString("direction")));
    }
}
