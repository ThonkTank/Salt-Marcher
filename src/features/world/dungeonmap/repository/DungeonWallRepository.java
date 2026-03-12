package features.world.dungeonmap.repository;

import features.world.dungeonmap.model.DungeonEdgeSummary;
import features.world.dungeonmap.model.DungeonEdgeSummaryBuilder;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.model.DungeonWall;
import features.world.dungeonmap.model.DungeonWallEdit;
import features.world.dungeonmap.model.PassageDirection;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

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
     * Keep this aligned with the shared derived edge model so preview/read behavior and
     * persisted boundary-wall normalization follow the same boundary rule.
     */
    public static void normalizePersistedBoundaryWalls(Connection conn, long mapId) throws SQLException {
        List<DungeonSquare> squares = DungeonSquareRepository.getSquares(conn, mapId);
        List<DungeonWall> walls = getWalls(conn, mapId);
        Set<String> persistedEdges = new HashSet<>();
        for (DungeonWall wall : walls) {
            persistedEdges.add(wall.edgeKey());
        }

        List<DungeonWall> missingBoundaryWalls = new ArrayList<>();
        List<DungeonWall> orphanWalls = new ArrayList<>();
        for (DungeonEdgeSummary edge : DungeonEdgeSummaryBuilder.buildPreviewIndex(squares, walls, List.of()).edgesByKey().values()) {
            if (edge.isBoundary() && edge.wallPresent() && !persistedEdges.contains(edge.edgeKey())) {
                missingBoundaryWalls.add(new DungeonWall(null, mapId, edge.x(), edge.y(), edge.direction()));
            }
            if (edge.wall() != null && !edge.hasInteractiveContext()) {
                orphanWalls.add(edge.wall());
            }
        }

        insertWalls(conn, missingBoundaryWalls);
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
}
