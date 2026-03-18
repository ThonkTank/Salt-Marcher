package features.world.dungeonmap.layout.persistence;

import features.world.dungeonmap.corridors.model.CorridorDoorOverride;
import features.world.dungeonmap.corridors.model.CorridorWaypoint;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.catalog.model.DungeonMap;
import features.world.dungeonmap.rooms.model.DungeonRoom;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.foundation.geometry.Point2i;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public final class DungeonLayoutReadRepository {

    private DungeonLayoutReadRepository() {
    }

    /** Appends {@code value} to the list stored at {@code key}, creating the list if absent. */
    private static <K, V> void addToMultiMap(Map<K, List<V>> map, K key, V value) {
        map.computeIfAbsent(key, ignored -> new ArrayList<>()).add(value);
    }

    public static Optional<DungeonLayout> loadLayout(Connection conn, long mapId) throws SQLException {
        DungeonMap map = null;
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT dungeon_map_id, name FROM dungeon_maps WHERE dungeon_map_id=?")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    map = new DungeonMap(rs.getLong("dungeon_map_id"), rs.getString("name"));
                }
            }
        }
        if (map == null) {
            return Optional.empty();
        }

        List<DungeonRoom> rooms = loadRooms(conn, mapId);
        List<DungeonCorridor> corridors = loadCorridors(conn, mapId);
        List<DungeonRoomCluster> clusters = loadClusters(conn, mapId);
        return Optional.of(new DungeonLayout(map, rooms, corridors, clusters));
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
        Map<Long, List<Point2i>> verticesByClusterId = new HashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT cluster_id, relative_x, relative_y FROM dungeon_room_cluster_vertices"
                        + " WHERE cluster_id IN (SELECT cluster_id FROM dungeon_room_clusters WHERE dungeon_map_id=?)"
                        + " ORDER BY cluster_id, vertex_index")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    addToMultiMap(verticesByClusterId, rs.getLong("cluster_id"),
                            new Point2i(rs.getInt("relative_x"), rs.getInt("relative_y")));
                }
            }
        }

        Map<Long, List<DungeonRoomCluster.EdgeOverride>> edgesByClusterId = new HashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT cluster_id, cell_x, cell_y, edge_direction, edge_type FROM dungeon_room_cluster_edges"
                        + " WHERE cluster_id IN (SELECT cluster_id FROM dungeon_room_clusters WHERE dungeon_map_id=?)"
                        + " ORDER BY cluster_id, cell_y, cell_x, edge_direction")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    addToMultiMap(edgesByClusterId, rs.getLong("cluster_id"),
                            DungeonRoomCluster.EdgeOverride.of(
                                    new Point2i(rs.getInt("cell_x"), rs.getInt("cell_y")),
                                    DungeonRoomCluster.EdgeDirection.valueOf(rs.getString("edge_direction")),
                                    DungeonRoomCluster.EdgeType.valueOf(rs.getString("edge_type"))));
                }
            }
        }

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

    private record CorridorRow(long id, List<Long> memberRoomIds) {}

    private static List<DungeonCorridor> loadCorridors(Connection conn, long mapId) throws SQLException {
        Map<Long, CorridorRow> corridorRows = loadCorridorRows(conn, mapId);
        Map<Long, List<CorridorDoorOverride>> doorOverrides = loadDoorOverrides(conn, mapId);
        Map<Long, List<CorridorWaypoint>> waypoints = loadWaypoints(conn, mapId);

        List<DungeonCorridor> result = new ArrayList<>();
        for (CorridorRow row : corridorRows.values()) {
            result.add(new DungeonCorridor(
                    row.id(),
                    mapId,
                    row.memberRoomIds(),
                    doorOverrides.getOrDefault(row.id(), List.of()),
                    waypoints.getOrDefault(row.id(), List.of())));
        }
        return result;
    }

    private static Map<Long, CorridorRow> loadCorridorRows(Connection conn, long mapId) throws SQLException {
        // LinkedHashMap preserves the ORDER BY corridor_id sequence from the DB so that corridors
        // are returned in a stable, deterministic order that matches their creation order.
        Map<Long, List<Long>> membersByCorridorId = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT c.corridor_id, m.room_id"
                        + " FROM dungeon_corridors c"
                        + " LEFT JOIN dungeon_corridor_members m ON m.corridor_id=c.corridor_id"
                        + " WHERE c.dungeon_map_id=?"
                        + " ORDER BY c.corridor_id, m.member_order, m.room_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long corridorId = rs.getLong("corridor_id");
                    long roomId = rs.getLong("room_id");
                    if (!rs.wasNull()) {
                        addToMultiMap(membersByCorridorId, corridorId, roomId);
                    } else {
                        // Corridor with no members (empty LEFT JOIN result): ensure key exists
                        // so that the corridor itself is still included in the output.
                        membersByCorridorId.putIfAbsent(corridorId, new ArrayList<>());
                    }
                }
            }
        }
        // LinkedHashMap preserves insertion order so CorridorRow sequence matches corridor_id ordering from DB.
        Map<Long, CorridorRow> result = new LinkedHashMap<>();
        for (Map.Entry<Long, List<Long>> e : membersByCorridorId.entrySet()) {
            result.put(e.getKey(), new CorridorRow(e.getKey(), e.getValue()));
        }
        return result;
    }

    private static Map<Long, List<CorridorDoorOverride>> loadDoorOverrides(Connection conn, long mapId) throws SQLException {
        Map<Long, List<CorridorDoorOverride>> doorOverridesByCorridorId = new HashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT corridor_id, room_id, cluster_id, relative_cell_x, relative_cell_y, edge_direction"
                        + " FROM dungeon_corridor_door_overrides"
                        + " WHERE corridor_id IN (SELECT corridor_id FROM dungeon_corridors WHERE dungeon_map_id=?)"
                        + " ORDER BY corridor_id, sort_order, room_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    addToMultiMap(doorOverridesByCorridorId, rs.getLong("corridor_id"),
                            new CorridorDoorOverride(
                                    rs.getLong("room_id"),
                                    rs.getLong("cluster_id"),
                                    new Point2i(rs.getInt("relative_cell_x"), rs.getInt("relative_cell_y")),
                                    DungeonRoomCluster.EdgeDirection.valueOf(rs.getString("edge_direction"))));
                }
            }
        }
        return doorOverridesByCorridorId;
    }

    private static Map<Long, List<CorridorWaypoint>> loadWaypoints(Connection conn, long mapId) throws SQLException {
        Map<Long, List<CorridorWaypoint>> waypointsByCorridorId = new HashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT corridor_id, cluster_id, relative_x, relative_y"
                        + " FROM dungeon_corridor_waypoints"
                        + " WHERE corridor_id IN (SELECT corridor_id FROM dungeon_corridors WHERE dungeon_map_id=?)"
                        + " ORDER BY corridor_id, sort_order")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    addToMultiMap(waypointsByCorridorId, rs.getLong("corridor_id"),
                            new CorridorWaypoint(
                                    rs.getLong("cluster_id"),
                                    new Point2i(rs.getInt("relative_x"), rs.getInt("relative_y"))));
                }
            }
        }
        return waypointsByCorridorId;
    }
}
