package features.world.dungeonmap.repository;

import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.objects.StructureObject;
import features.world.dungeonmap.model.objects.Wall;
import features.world.dungeonmap.model.objects.WallKind;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

/**
 * Canonical storage owner for authored room-cluster walls.
 *
 * <p>Boundary topology remains on the structure aggregate; this repository stores authored wall identity and wall-kind
 * assignments for boundary paths that the user explicitly created or customized.
 */
public final class DungeonWallRepository {

    public StructureObject assignPersistentIds(Connection conn, StructureObject structure) throws SQLException {
        if (structure == null || structure.levelStructures().isEmpty()) {
            return structure == null ? StructureObject.empty() : structure;
        }
        long nextWallId = nextWallId(conn);
        StructureObject updated = structure;
        for (Map.Entry<Integer, StructureObject.LevelStructure> entry : structure.levelStructures().entrySet()) {
            int levelZ = entry.getKey();
            List<Wall> levelWalls = entry.getValue() == null ? List.of() : entry.getValue().walls();
            if (levelWalls.isEmpty()) {
                continue;
            }
            ArrayList<Wall> persistedWalls = new ArrayList<>(levelWalls.size());
            boolean changed = false;
            for (Wall wall : levelWalls) {
                if (wall == null || wall.isEmpty()) {
                    continue;
                }
                Wall persistedWall = wall;
                if (wall.wallId() == null || wall.wallId() <= 0L) {
                    persistedWall = wall.withWallId(nextWallId++);
                    changed = true;
                }
                persistedWalls.add(persistedWall);
            }
            if (changed) {
                updated = updated.withWallsAtLevel(levelZ, persistedWalls);
            }
        }
        return updated;
    }

    public void replaceClusterWalls(Connection conn, long clusterId, StructureObject structure) throws SQLException {
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_cluster_walls WHERE cluster_id=?")) {
            delete.setLong(1, clusterId);
            delete.executeUpdate();
        }
        if (structure == null || structure.levelStructures().isEmpty()) {
            return;
        }
        try (PreparedStatement insertWall = conn.prepareStatement(
                "INSERT INTO dungeon_cluster_walls(wall_id, cluster_id, level_z, wall_kind_id,"
                        + " anchor_start_x2, anchor_start_y2, anchor_end_x2, anchor_end_y2)"
                        + " VALUES(?,?,?,?,?,?,?,?)");
             PreparedStatement insertSegment = conn.prepareStatement(
                     "INSERT INTO dungeon_cluster_wall_segments(wall_id, start_x2, start_y2, end_x2, end_y2)"
                             + " VALUES(?,?,?,?,?)")) {
            for (Map.Entry<Integer, StructureObject.LevelStructure> entry : structure.levelStructures().entrySet()) {
                int levelZ = entry.getKey();
                StructureObject.LevelStructure level = entry.getValue();
                if (level == null) {
                    continue;
                }
                for (Wall wall : level.walls()) {
                    if (wall == null || wall.isEmpty() || wall.wallId() == null || wall.wallId() <= 0L) {
                        throw new IllegalArgumentException("Persisted walls require a stable positive wall id");
                    }
                    GridSegment2x anchorSegment2x = wall.anchorSegment2x() == null ? wall.firstSegment2x() : wall.anchorSegment2x();
                    WallKind wallKind = wall.wallKind();
                    insertWall.setLong(1, wall.wallId());
                    insertWall.setLong(2, clusterId);
                    insertWall.setInt(3, levelZ);
                    insertWall.setLong(4, wallKind.wallKindId());
                    insertWall.setInt(5, anchorSegment2x.start().x2());
                    insertWall.setInt(6, anchorSegment2x.start().y2());
                    insertWall.setInt(7, anchorSegment2x.end().x2());
                    insertWall.setInt(8, anchorSegment2x.end().y2());
                    insertWall.addBatch();
                    for (GridSegment2x segment2x : wall.segments2x().stream().sorted(GridSegment2x.ORDER).toList()) {
                        insertSegment.setLong(1, wall.wallId());
                        insertSegment.setInt(2, segment2x.start().x2());
                        insertSegment.setInt(3, segment2x.start().y2());
                        insertSegment.setInt(4, segment2x.end().x2());
                        insertSegment.setInt(5, segment2x.end().y2());
                        insertSegment.addBatch();
                    }
                }
            }
            insertWall.executeBatch();
            insertSegment.executeBatch();
        }
    }

    public Map<Long, Map<Integer, List<Wall>>> loadClusterWallsByClusterId(
            Connection conn,
            long mapId,
            Map<Long, WallKind> wallKindsById
    ) throws SQLException {
        Map<Long, Map<Integer, LinkedHashMap<Long, MutableWall>>> mutable = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT w.cluster_id, w.wall_id, w.level_z, w.wall_kind_id,"
                        + " w.anchor_start_x2, w.anchor_start_y2, w.anchor_end_x2, w.anchor_end_y2,"
                        + " s.start_x2, s.start_y2, s.end_x2, s.end_y2"
                        + " FROM dungeon_cluster_walls w"
                        + " JOIN dungeon_cluster_wall_segments s ON s.wall_id=w.wall_id"
                        + " WHERE w.cluster_id IN (SELECT cluster_id FROM dungeon_room_clusters WHERE dungeon_map_id=?)"
                        + " ORDER BY w.cluster_id, w.level_z, w.wall_id, s.start_y2, s.start_x2, s.end_y2, s.end_x2")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long clusterId = rs.getLong("cluster_id");
                    int levelZ = rs.getInt("level_z");
                    long wallId = rs.getLong("wall_id");
                    WallKind wallKind = resolvedWallKind(wallKindsById, rs.getLong("wall_kind_id"));
                    GridSegment2x anchorSegment2x = new GridSegment2x(
                            GridPoint2x.raw(rs.getInt("anchor_start_x2"), rs.getInt("anchor_start_y2")),
                            GridPoint2x.raw(rs.getInt("anchor_end_x2"), rs.getInt("anchor_end_y2")));
                    LinkedHashMap<Long, MutableWall> wallsById = mutable
                            .computeIfAbsent(clusterId, ignored -> new LinkedHashMap<>())
                            .computeIfAbsent(levelZ, ignored -> new LinkedHashMap<>());
                    MutableWall mutableWall = wallsById.computeIfAbsent(
                            wallId,
                            ignored -> new MutableWall(wallId, anchorSegment2x, wallKind));
                    mutableWall.segments().add(new GridSegment2x(
                            GridPoint2x.raw(rs.getInt("start_x2"), rs.getInt("start_y2")),
                            GridPoint2x.raw(rs.getInt("end_x2"), rs.getInt("end_y2"))));
                }
            }
        }
        Map<Long, Map<Integer, List<Wall>>> result = new LinkedHashMap<>();
        for (Map.Entry<Long, Map<Integer, LinkedHashMap<Long, MutableWall>>> ownerEntry : mutable.entrySet()) {
            Map<Integer, List<Wall>> levels = new LinkedHashMap<>();
            for (Map.Entry<Integer, LinkedHashMap<Long, MutableWall>> levelEntry : ownerEntry.getValue().entrySet()) {
                List<Wall> walls = levelEntry.getValue().values().stream()
                        .map(MutableWall::toWall)
                        .sorted(Comparator.comparing(Wall::anchorSegment2x, GridSegment2x.ORDER))
                        .toList();
                levels.put(levelEntry.getKey(), walls);
            }
            result.put(ownerEntry.getKey(), Map.copyOf(levels));
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static WallKind resolvedWallKind(Map<Long, WallKind> wallKindsById, long wallKindId) {
        if (wallKindsById == null || wallKindsById.isEmpty()) {
            return WallKind.solid();
        }
        return wallKindsById.getOrDefault(wallKindId, WallKind.solid());
    }

    private static long nextWallId(Connection conn) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT COALESCE(MAX(wall_id), 0) + 1 AS next_id FROM dungeon_cluster_walls");
             ResultSet rs = ps.executeQuery()) {
            if (!rs.next()) {
                throw new SQLException("Nächste Wand-ID konnte nicht bestimmt werden");
            }
            return rs.getLong("next_id");
        }
    }

    private record MutableWall(
            long wallId,
            GridSegment2x anchorSegment2x,
            WallKind wallKind,
            LinkedHashSet<GridSegment2x> segments
    ) {
        private MutableWall(long wallId, GridSegment2x anchorSegment2x, WallKind wallKind) {
            this(wallId, anchorSegment2x, wallKind, new LinkedHashSet<>());
        }

        private Wall toWall() {
            return Wall.fromSegments(wallId, segments, anchorSegment2x, wallKind);
        }
    }
}
