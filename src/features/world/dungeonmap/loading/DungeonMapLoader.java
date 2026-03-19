package features.world.dungeonmap.loading;

import database.DatabaseManager;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.objects.TileShape;
import features.world.dungeonmap.model.objects.Wall;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class DungeonMapLoader {

    public DungeonMapLoadResult loadInitial() throws SQLException {
        try (Connection conn = DatabaseManager.getConnection()) {
            List<DungeonMapCatalogEntry> maps = loadCatalog(conn);
            if (maps.isEmpty()) {
                return new DungeonMapLoadResult(List.of(), null, null);
            }
            return loadExistingMap(conn, maps, maps.getFirst());
        }
    }

    public DungeonMapLoadResult loadMap(long mapId, List<DungeonMapCatalogEntry> fallbackMaps) throws SQLException {
        try (Connection conn = DatabaseManager.getConnection()) {
            List<DungeonMapCatalogEntry> maps = loadCatalog(conn);
            DungeonMapCatalogEntry map = findMap(maps, mapId);
            if (map == null) {
                return new DungeonMapLoadResult(
                        fallbackMaps,
                        null,
                        "Dungeon " + mapId + " existiert nicht mehr");
            }
            return loadExistingMap(conn, maps, map);
        }
    }

    private static DungeonMapLoadResult loadExistingMap(
            Connection conn,
            List<DungeonMapCatalogEntry> maps,
            DungeonMapCatalogEntry map
    ) throws SQLException {
        List<Room> rooms = loadRooms(conn, map.mapId());
        return new DungeonMapLoadResult(
                maps,
                new DungeonLayout(
                        map.mapId(),
                        map.name(),
                        loadCorridors(conn, map.mapId()),
                        loadClusters(conn, map.mapId(), rooms)),
                null);
    }

    private static List<DungeonMapCatalogEntry> loadCatalog(Connection conn) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT dungeon_map_id, name FROM dungeon_maps ORDER BY dungeon_map_id");
             ResultSet rs = ps.executeQuery()) {
            List<DungeonMapCatalogEntry> result = new ArrayList<>();
            while (rs.next()) {
                result.add(new DungeonMapCatalogEntry(
                        rs.getLong("dungeon_map_id"),
                        rs.getString("name")));
            }
            return List.copyOf(result);
        }
    }

    private static DungeonMapCatalogEntry findMap(List<DungeonMapCatalogEntry> maps, long mapId) {
        for (DungeonMapCatalogEntry map : maps) {
            if (map.mapId() == mapId) {
                return map;
            }
        }
        return null;
    }

    private static List<Room> loadRooms(Connection conn, long mapId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT room_id, dungeon_map_id, cluster_id, name, component_x, component_y"
                        + " FROM dungeon_rooms WHERE dungeon_map_id=? ORDER BY room_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                List<Room> rooms = new ArrayList<>();
                while (rs.next()) {
                    long roomId = rs.getLong("room_id");
                    Point2i anchor = new Point2i(rs.getInt("component_x"), rs.getInt("component_y"));
                    rooms.add(new Room(
                            roomId,
                            rs.getLong("dungeon_map_id"),
                            rs.getLong("cluster_id"),
                            normalizedRoomName(roomId, rs.getString("name")),
                            TileShape.singleCell(anchor)));
                }
                return List.copyOf(rooms);
            }
        }
    }

    private static List<Corridor> loadCorridors(Connection conn, long mapId) throws SQLException {
        Map<Long, List<Long>> roomIdsByCorridor = new LinkedHashMap<>();
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
                    roomIdsByCorridor.computeIfAbsent(corridorId, ignored -> new ArrayList<>());
                    long roomId = rs.getLong("room_id");
                    if (!rs.wasNull()) {
                        roomIdsByCorridor.get(corridorId).add(roomId);
                    }
                }
            }
        }
        List<Corridor> result = new ArrayList<>();
        for (Map.Entry<Long, List<Long>> entry : roomIdsByCorridor.entrySet()) {
            result.add(new Corridor(entry.getKey(), mapId, entry.getValue()));
        }
        return List.copyOf(result);
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

    private static List<RoomCluster> loadClusters(Connection conn, long mapId, List<Room> rooms) throws SQLException {
        Map<Long, List<Point2i>> verticesByClusterId = loadGrouped(conn,
                "SELECT cluster_id, relative_x, relative_y FROM dungeon_room_cluster_vertices"
                        + " WHERE cluster_id IN (SELECT cluster_id FROM dungeon_room_clusters WHERE dungeon_map_id=?)"
                        + " ORDER BY cluster_id, vertex_index",
                mapId,
                rs -> rs.getLong("cluster_id"),
                rs -> new Point2i(rs.getInt("relative_x"), rs.getInt("relative_y")));

        Map<Long, List<EdgeObject>> edgesByClusterId = loadGrouped(conn,
                "SELECT cluster_id, cell_x, cell_y, edge_direction, edge_type FROM dungeon_room_cluster_edges"
                        + " WHERE cluster_id IN (SELECT cluster_id FROM dungeon_room_clusters WHERE dungeon_map_id=?)"
                        + " ORDER BY cluster_id, cell_y, cell_x, edge_direction",
                mapId,
                rs -> rs.getLong("cluster_id"),
                rs -> edgeObject(
                        new Point2i(rs.getInt("cell_x"), rs.getInt("cell_y")),
                        rs.getString("edge_direction"),
                        rs.getString("edge_type")));

        List<RoomCluster> clusters = new ArrayList<>();
        Map<Long, List<Room>> roomsByClusterId = roomsByClusterId(rooms);
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT cluster_id, dungeon_map_id, center_x, center_y FROM dungeon_room_clusters"
                        + " WHERE dungeon_map_id=? ORDER BY cluster_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long clusterId = rs.getLong("cluster_id");
                    List<EdgeObject> edgeObjects = List.copyOf(edgesByClusterId.getOrDefault(clusterId, List.of()));
                    RoomCluster cluster = new RoomCluster(
                            clusterId,
                            rs.getLong("dungeon_map_id"),
                            TileShape.fromRelativeVertices(
                                    new Point2i(rs.getInt("center_x"), rs.getInt("center_y")),
                                    List.copyOf(verticesByClusterId.getOrDefault(clusterId, List.of()))),
                            edgeObjects.stream().filter(EdgeObject::isWall).map(EdgeObject::wall).toList(),
                            edgeObjects.stream().filter(EdgeObject::isDoor).map(EdgeObject::door).toList());
                    clusters.add(cluster.withRooms(roomsByClusterId.getOrDefault(clusterId, List.of())));
                }
            }
        }
        return List.copyOf(clusters);
    }

    private static Map<Long, List<Room>> roomsByClusterId(List<Room> rooms) {
        Map<Long, List<Room>> result = new LinkedHashMap<>();
        for (Room room : rooms) {
            result.computeIfAbsent(room.clusterId(), ignored -> new ArrayList<>()).add(room);
        }
        return Map.copyOf(result);
    }

    @FunctionalInterface
    private interface ResultSetMapper<T> {
        T map(ResultSet rs) throws SQLException;
    }

    private static String normalizedRoomName(long roomId, String name) {
        return name == null || name.isBlank() ? "Raum " + roomId : name.trim();
    }

    private static EdgeObject edgeObject(Point2i roomCell, String direction, String type) {
        Point2i delta = switch (direction) {
            case "NORTH" -> new Point2i(0, -1);
            case "EAST" -> new Point2i(1, 0);
            case "SOUTH" -> new Point2i(0, 1);
            case "WEST" -> new Point2i(-1, 0);
            default -> new Point2i(0, 0);
        };
        TileShape shape = TileShape.singleCell(roomCell);
        if ("DOOR".equals(type)) {
            return new EdgeObject(null, new Door(roomCell, delta, shape));
        }
        return new EdgeObject(new Wall(roomCell, delta, shape), null);
    }

    private record EdgeObject(Wall wall, Door door) {
        boolean isWall() {
            return wall != null;
        }

        boolean isDoor() {
            return door != null;
        }
    }
}
