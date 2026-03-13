package features.world.dungeonmap.repository.topology;

import features.world.dungeonmap.model.topology.DungeonEdgeRules;
import features.world.dungeonmap.model.domain.DungeonSquare;
import features.world.dungeonmap.model.domain.DungeonWall;
import features.world.dungeonmap.model.editing.DungeonWallEdit;
import features.world.dungeonmap.model.domain.PassageDirection;
import features.world.dungeonmap.repository.map.DungeonSquareRepository;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

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

    /*
     * Compatibility cleanup removes legacy topology-owned boundary rows so persisted walls only
     * represent manual interior barriers. Derived edge models synthesize one-sided boundaries.
     */
    public static void deleteDerivedBoundaryWallsAndOrphans(Connection conn, long mapId) throws SQLException {
        List<DungeonSquare> squares = DungeonSquareRepository.getSquares(conn, mapId);
        List<DungeonWall> walls = getWalls(conn, mapId);
        Map<String, DungeonSquare> squaresByCoord = squaresByCoord(squares);
        List<DungeonWall> orphanWalls = new ArrayList<>();

        for (DungeonWall wall : walls) {
            DungeonSquare sideA = squaresByCoord.get(coordKey(wall.x(), wall.y()));
            DungeonSquare sideB = wall.direction() == PassageDirection.EAST
                    ? squaresByCoord.get(coordKey(wall.x() + 1, wall.y()))
                    : squaresByCoord.get(coordKey(wall.x(), wall.y() + 1));
            if (!DungeonEdgeRules.canPersistManualWall(sideA, sideB)) {
                orphanWalls.add(wall);
            }
        }

        deleteWalls(conn, orphanWalls);
    }

    private static void insertWalls(Connection conn, List<DungeonWall> walls) throws SQLException {
        if (walls == null || walls.isEmpty()) {
            return;
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_walls(map_id, x, y, direction) VALUES(?,?,?,?) "
                        + "ON CONFLICT(map_id, x, y, direction) DO NOTHING")) {
            for (DungeonWall wall : walls) {
                ps.setLong(1, wall.mapId());
                ps.setInt(2, wall.x());
                ps.setInt(3, wall.y());
                ps.setString(4, wall.direction().dbValue());
                ps.addBatch();
            }
            ps.executeBatch();
        }
    }

    private static void deleteWalls(Connection conn, List<DungeonWall> walls) throws SQLException {
        if (walls == null || walls.isEmpty()) {
            return;
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_walls WHERE map_id=? AND x=? AND y=? AND direction=?")) {
            for (DungeonWall wall : walls) {
                ps.setLong(1, wall.mapId());
                ps.setInt(2, wall.x());
                ps.setInt(3, wall.y());
                ps.setString(4, wall.direction().dbValue());
                ps.addBatch();
            }
            ps.executeBatch();
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

    private static Map<String, DungeonSquare> squaresByCoord(List<DungeonSquare> squares) {
        java.util.Map<String, DungeonSquare> result = new java.util.HashMap<>();
        for (DungeonSquare square : squares) {
            result.put(coordKey(square.x(), square.y()), square);
        }
        return result;
    }

    private static String coordKey(int x, int y) {
        return x + ":" + y;
    }
}
