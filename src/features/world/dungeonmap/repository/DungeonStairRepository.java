package features.world.dungeonmap.repository;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.stair.DungeonStair;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Persists only the canonical stair owner fields: top-level identity/name and the explicit ordered path.
 *
 * <p>Do not reintroduce generated spec fields or persisted exits here. Those are intentionally derived outside
 * persistence from the path plus the loaded room/corridor layout.
 */
public final class DungeonStairRepository {

    public List<DungeonStair> loadByMap(
            Connection conn,
            long mapId,
            List<RoomCluster> clusters,
            List<Corridor> corridors
    ) throws SQLException {
        Map<Long, List<CubePoint>> pathByStairId = loadGrouped(
                conn,
                "SELECT stair_id, cell_x, cell_y, cell_z"
                        + " FROM dungeon_stair_path_nodes"
                        + " WHERE stair_id IN (SELECT stair_id FROM dungeon_stairs WHERE dungeon_map_id=?)"
                        + " ORDER BY stair_id, sort_order",
                mapId,
                rs -> rs.getLong("stair_id"),
                rs -> new CubePoint(rs.getInt("cell_x"), rs.getInt("cell_y"), rs.getInt("cell_z")));
        Set<CubePoint> occupiedFloorPoints = occupiedFloorPoints(clusters, corridors);
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
                            occupiedFloorPoints));
                }
                return result.isEmpty() ? List.of() : List.copyOf(result);
            }
        }
    }

    public long insertStair(
            Connection conn,
            long mapId,
            DungeonStair stair
    ) throws SQLException {
        DungeonStair resolvedStair = Objects.requireNonNull(stair, "stair");
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_stairs(dungeon_map_id, name) VALUES(?, ?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, mapId);
            ps.setString(2, resolvedStair.name());
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
            DungeonStair stair
    ) throws SQLException {
        DungeonStair resolvedStair = Objects.requireNonNull(stair, "stair");
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_stairs SET name=? WHERE stair_id=?")) {
            ps.setString(1, resolvedStair.name());
            ps.setLong(2, stairId);
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

    public void deleteStair(Connection conn, long stairId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_stairs WHERE stair_id=?")) {
            ps.setLong(1, stairId);
            ps.executeUpdate();
        }
    }

    private static Set<CubePoint> occupiedFloorPoints(
            List<RoomCluster> clusters,
            List<Corridor> corridors
    ) {
        LinkedHashSet<CubePoint> result = new LinkedHashSet<>();
        for (RoomCluster cluster : clusters == null ? List.<RoomCluster>of() : clusters) {
            if (cluster == null) {
                continue;
            }
            cluster.rooms().stream()
                    .filter(Objects::nonNull)
                    .forEach(room -> result.addAll(room.structure().cubePoints()));
        }
        for (Corridor corridor : corridors == null ? List.<Corridor>of() : corridors) {
            if (corridor != null) {
                result.addAll(corridor.structure().cubePoints());
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static <K, V> java.util.Map<K, List<V>> loadGrouped(
            Connection conn,
            String sql,
            long mapId,
            ResultSetMapper<K> keyExtractor,
            ResultSetMapper<V> valueExtractor
    ) throws SQLException {
        java.util.Map<K, List<V>> result = new java.util.LinkedHashMap<>();
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
