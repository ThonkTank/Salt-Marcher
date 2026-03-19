package features.world.quarantine.dungeonmap.layout.persistence;

import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.corridors.persistence.DungeonCorridorPersistenceRepository;
import features.world.quarantine.dungeonmap.catalog.model.DungeonMap;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public final class DungeonLayoutReadRepository {

    private DungeonLayoutReadRepository() {
        throw new AssertionError("No instances");
    }

    @FunctionalInterface
    private interface RowMapper<T> {
        T map(ResultSet rs) throws SQLException;
    }

    /**
     * Executes {@code sql} with a single long parameter, groups rows into a multimap by key.
     * When the value mapper returns {@code null}, the key is still recorded with an empty list
     * (useful for LEFT JOIN queries where child rows may be absent).
     */
    private static <K, V> Map<K, List<V>> loadGrouped(
            Connection conn, String sql, long param,
            RowMapper<K> keyExtractor, RowMapper<V> valueExtractor) throws SQLException {
        Map<K, List<V>> result = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, param);
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

    public static Optional<DungeonLayout> loadLayout(Connection conn, long mapId) throws SQLException {
        DungeonMap map = loadMap(conn, mapId);
        if (map == null) {
            return Optional.empty();
        }
        return loadLayout(conn, map);
    }

    public static Optional<DungeonLayout> loadLayout(Connection conn, DungeonMap map) throws SQLException {
        if (map == null) {
            return Optional.empty();
        }

        long mapId = map.mapId();
        List<DungeonRoom> rooms = loadRooms(conn, mapId);
        List<DungeonCorridor> corridors = DungeonCorridorPersistenceRepository.loadCorridors(conn, mapId);
        List<DungeonRoomCluster> clusters = loadClusters(conn, mapId);
        return Optional.of(new DungeonLayout(map, rooms, corridors, clusters));
    }

    private static DungeonMap loadMap(Connection conn, long mapId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT dungeon_map_id, name FROM dungeon_maps WHERE dungeon_map_id=?")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return new DungeonMap(rs.getLong("dungeon_map_id"), rs.getString("name"));
                }
            }
        }
        return null;
    }

    private static List<DungeonRoom> loadRooms(Connection conn, long mapId) throws SQLException {
        List<DungeonRoom> rooms = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT room_id, dungeon_map_id, cluster_id, name, component_x, component_y FROM dungeon_rooms"
                        + " WHERE dungeon_map_id=? ORDER BY room_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    rooms.add(new DungeonRoom(
                            rs.getLong("room_id"),
                            rs.getLong("dungeon_map_id"),
                            rs.getLong("cluster_id"),
                            rs.getString("name"),
                            new Point2i(rs.getInt("component_x"), rs.getInt("component_y"))));
                }
            }
        }
        return rooms;
    }

    // Cluster vertices and edge overrides are loaded with separate queries rather than a single JOIN
    // because joining both child tables to dungeon_room_clusters in one query would produce a cross
    // product (vertices × edges per cluster), yielding duplicate and incorrect rows.
    private static List<DungeonRoomCluster> loadClusters(Connection conn, long mapId) throws SQLException {
        Map<Long, List<Point2i>> verticesByClusterId = loadGrouped(conn,
                "SELECT cluster_id, relative_x, relative_y FROM dungeon_room_cluster_vertices"
                        + " WHERE cluster_id IN (SELECT cluster_id FROM dungeon_room_clusters WHERE dungeon_map_id=?)"
                        + " ORDER BY cluster_id, vertex_index",
                mapId,
                rs -> rs.getLong("cluster_id"),
                rs -> new Point2i(rs.getInt("relative_x"), rs.getInt("relative_y")));

        Map<Long, List<DungeonRoomCluster.EdgeOverride>> edgesByClusterId = loadGrouped(conn,
                "SELECT cluster_id, cell_x, cell_y, edge_direction, edge_type FROM dungeon_room_cluster_edges"
                        + " WHERE cluster_id IN (SELECT cluster_id FROM dungeon_room_clusters WHERE dungeon_map_id=?)"
                        + " ORDER BY cluster_id, cell_y, cell_x, edge_direction",
                mapId,
                rs -> rs.getLong("cluster_id"),
                rs -> DungeonRoomCluster.EdgeOverride.of(
                        new Point2i(rs.getInt("cell_x"), rs.getInt("cell_y")),
                        DungeonRoomCluster.EdgeDirection.valueOf(rs.getString("edge_direction")),
                        DungeonRoomCluster.EdgeType.valueOf(rs.getString("edge_type"))));

        List<DungeonRoomCluster> clusters = new ArrayList<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT cluster_id, dungeon_map_id, center_x, center_y FROM dungeon_room_clusters"
                        + " WHERE dungeon_map_id=? ORDER BY cluster_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long clusterId = rs.getLong("cluster_id");
                    clusters.add(new DungeonRoomCluster(
                            clusterId,
                            rs.getLong("dungeon_map_id"),
                            new Point2i(rs.getInt("center_x"), rs.getInt("center_y")),
                            List.copyOf(verticesByClusterId.getOrDefault(clusterId, List.of())),
                            List.copyOf(edgesByClusterId.getOrDefault(clusterId, List.of()))));
                }
            }
        }
        return clusters;
    }

}
