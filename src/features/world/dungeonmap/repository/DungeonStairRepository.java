package features.world.dungeonmap.repository;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.stair.StairShape;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Persists only the canonical stair owner fields plus the editor-reopen metadata that generated that path.
 *
 * <p>The persisted stair structure remains the explicit ordered path plus authored stop levels. Shape, direction,
 * anchor, and dimension fields are editor metadata used to reopen and edit a stair without reverse-engineering it
 * from the path.
 */
public final class DungeonStairRepository {

    public record StairEditorData(
            String name,
            CellCoord anchorCell,
            int anchorLevelZ,
            StairShape shape,
            CardinalDirection direction,
            int minLevelZ,
            int maxLevelZ,
            int dimension1,
            int dimension2,
            Set<Integer> stopLevels
    ) {
        public StairEditorData {
            anchorCell = Objects.requireNonNull(anchorCell, "anchorCell");
            shape = Objects.requireNonNull(shape, "shape");
            direction = Objects.requireNonNull(direction, "direction");
            stopLevels = stopLevels == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(stopLevels));
        }
    }

    public List<DungeonStair> loadByMap(Connection conn, long mapId) throws SQLException {
        Map<Long, List<CubePoint>> pathByStairId = loadGrouped(
                conn,
                "SELECT stair_id, cell_x, cell_y, cell_z"
                        + " FROM dungeon_stair_path_nodes"
                        + " WHERE stair_id IN (SELECT stair_id FROM dungeon_stairs WHERE dungeon_map_id=?)"
                        + " ORDER BY stair_id, sort_order",
                mapId,
                rs -> rs.getLong("stair_id"),
                rs -> new CubePoint(rs.getInt("cell_x"), rs.getInt("cell_y"), rs.getInt("cell_z")));
        Map<Long, Set<Integer>> stopLevelsByStairId = loadStopLevelsByStairId(conn, mapId);
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT stair_id, dungeon_map_id, name"
                        + " FROM dungeon_stairs WHERE dungeon_map_id=? ORDER BY stair_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                List<DungeonStair> result = new ArrayList<>();
                while (rs.next()) {
                    long stairId = rs.getLong("stair_id");
                    result.add(DungeonStair.resolved(
                            stairId,
                            rs.getLong("dungeon_map_id"),
                            rs.getString("name"),
                            pathByStairId.getOrDefault(stairId, List.of()),
                            stopLevelsByStairId.getOrDefault(stairId, Set.of())));
                }
                return result.isEmpty() ? List.of() : List.copyOf(result);
            }
        }
    }

    public StairEditorData loadEditorData(Connection conn, long mapId, long stairId) throws SQLException {
        if (mapId <= 0 || stairId <= 0) {
            return null;
        }
        Set<Integer> stopLevels = loadStopLevels(conn, stairId);
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT name, anchor_cell_x, anchor_cell_y, anchor_level_z, shape, direction_code, "
                        + "dimension1, dimension2, min_level_z, max_level_z"
                        + " FROM dungeon_stairs WHERE dungeon_map_id=? AND stair_id=?")) {
            ps.setLong(1, mapId);
            ps.setLong(2, stairId);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                return new StairEditorData(
                        rs.getString("name"),
                        new CellCoord(rs.getInt("anchor_cell_x"), rs.getInt("anchor_cell_y")),
                        rs.getInt("anchor_level_z"),
                        StairShape.parse(rs.getString("shape")),
                        CardinalDirection.fromCode(rs.getInt("direction_code")),
                        rs.getInt("min_level_z"),
                        rs.getInt("max_level_z"),
                        rs.getInt("dimension1"),
                        rs.getInt("dimension2"),
                        stopLevels);
            }
        }
    }

    public long insertStair(
            Connection conn,
            long mapId,
            DungeonStair stair,
            StairEditorData editorData
    ) throws SQLException {
        DungeonStair resolvedStair = Objects.requireNonNull(stair, "stair");
        StairEditorData resolvedEditorData = Objects.requireNonNull(editorData, "editorData");
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_stairs("
                        + "dungeon_map_id, name, anchor_cell_x, anchor_cell_y, anchor_level_z, "
                        + "shape, direction_code, dimension1, dimension2, min_level_z, max_level_z"
                        + ") VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            bindEditorColumns(ps, mapId, resolvedStair, resolvedEditorData);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (!rs.next()) {
                    throw new SQLException("No key returned for dungeon_stairs insert");
                }
                return rs.getLong(1);
            }
        }
    }

    public void updateStair(
            Connection conn,
            long stairId,
            DungeonStair stair,
            StairEditorData editorData
    ) throws SQLException {
        DungeonStair resolvedStair = Objects.requireNonNull(stair, "stair");
        StairEditorData resolvedEditorData = Objects.requireNonNull(editorData, "editorData");
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_stairs SET "
                        + "name=?, anchor_cell_x=?, anchor_cell_y=?, anchor_level_z=?, "
                        + "shape=?, direction_code=?, dimension1=?, dimension2=?, min_level_z=?, max_level_z=? "
                        + "WHERE stair_id=?")) {
            ps.setString(1, resolvedStair.name());
            ps.setInt(2, resolvedEditorData.anchorCell().x());
            ps.setInt(3, resolvedEditorData.anchorCell().y());
            ps.setInt(4, resolvedEditorData.anchorLevelZ());
            ps.setString(5, resolvedEditorData.shape().name());
            ps.setInt(6, resolvedEditorData.direction().code());
            ps.setInt(7, resolvedEditorData.dimension1());
            ps.setInt(8, resolvedEditorData.dimension2());
            ps.setInt(9, resolvedEditorData.minLevelZ());
            ps.setInt(10, resolvedEditorData.maxLevelZ());
            ps.setLong(11, stairId);
            ps.executeUpdate();
        }
    }

    public void replacePathNodes(Connection conn, long stairId, List<CubePoint> pathNodes) throws SQLException {
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_stair_path_nodes WHERE stair_id=?")) {
            delete.setLong(1, stairId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_stair_path_nodes(stair_id, sort_order, cell_x, cell_y, cell_z) VALUES(?,?,?,?,?)")) {
            // Path order is the whole stair geometry contract.
            for (int index = 0; index < pathNodes.size(); index++) {
                CubePoint node = pathNodes.get(index);
                insert.setLong(1, stairId);
                insert.setInt(2, index);
                insert.setInt(3, node.x());
                insert.setInt(4, node.y());
                insert.setInt(5, node.z());
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    public void replaceStopLevels(Connection conn, long stairId, Set<Integer> stopLevels) throws SQLException {
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_stair_stop_levels WHERE stair_id=?")) {
            delete.setLong(1, stairId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_stair_stop_levels(stair_id, level_z) VALUES(?,?)")) {
            for (Integer stopLevel : stopLevels == null ? Set.<Integer>of() : stopLevels) {
                if (stopLevel == null) {
                    continue;
                }
                insert.setLong(1, stairId);
                insert.setInt(2, stopLevel);
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    public void deleteStair(Connection conn, long stairId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_stairs WHERE stair_id=?")) {
            ps.setLong(1, stairId);
            ps.executeUpdate();
        }
    }

    private static void bindEditorColumns(
            PreparedStatement ps,
            long mapId,
            DungeonStair stair,
            StairEditorData editorData
    ) throws SQLException {
        ps.setLong(1, mapId);
        ps.setString(2, stair.name());
        ps.setInt(3, editorData.anchorCell().x());
        ps.setInt(4, editorData.anchorCell().y());
        ps.setInt(5, editorData.anchorLevelZ());
        ps.setString(6, editorData.shape().name());
        ps.setInt(7, editorData.direction().code());
        ps.setInt(8, editorData.dimension1());
        ps.setInt(9, editorData.dimension2());
        ps.setInt(10, editorData.minLevelZ());
        ps.setInt(11, editorData.maxLevelZ());
    }

    private static Map<Long, Set<Integer>> loadStopLevelsByStairId(Connection conn, long mapId) throws SQLException {
        Map<Long, Set<Integer>> mutable = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT stair_id, level_z"
                        + " FROM dungeon_stair_stop_levels"
                        + " WHERE stair_id IN (SELECT stair_id FROM dungeon_stairs WHERE dungeon_map_id=?)"
                        + " ORDER BY stair_id, level_z")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    mutable.computeIfAbsent(rs.getLong("stair_id"), ignored -> new LinkedHashSet<>())
                            .add(rs.getInt("level_z"));
                }
            }
        }
        Map<Long, Set<Integer>> result = new LinkedHashMap<>();
        for (Map.Entry<Long, Set<Integer>> entry : mutable.entrySet()) {
            result.put(entry.getKey(), Set.copyOf(entry.getValue()));
        }
        return Map.copyOf(result);
    }

    private static Set<Integer> loadStopLevels(Connection conn, long stairId) throws SQLException {
        LinkedHashSet<Integer> result = new LinkedHashSet<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT level_z FROM dungeon_stair_stop_levels WHERE stair_id=? ORDER BY level_z")) {
            ps.setLong(1, stairId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.add(rs.getInt("level_z"));
                }
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static <K, V> Map<K, List<V>> loadGrouped(
            Connection conn,
            String sql,
            long mapId,
            ResultSetMapper<K> keyExtractor,
            ResultSetMapper<V> valueExtractor
    ) throws SQLException {
        Map<K, List<V>> result = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    K key = keyExtractor.map(rs);
                    V value = valueExtractor.map(rs);
                    if (value != null) {
                        result.computeIfAbsent(key, ignored -> new ArrayList<>()).add(value);
                    } else {
                        result.computeIfAbsent(key, ignored -> new ArrayList<>());
                    }
                }
            }
        }
        return result;
    }

    @FunctionalInterface
    private interface ResultSetMapper<T> {
        T map(ResultSet rs) throws SQLException;
    }
}
