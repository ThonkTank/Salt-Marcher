package features.world.dungeonmap.loading;

import database.DatabaseManager;
import features.world.dungeonmap.model.CorridorPlanningInputProjector;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.geometry.VertexPath;
import features.world.dungeonmap.model.objects.CorridorPath;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.objects.Floor;
import features.world.dungeonmap.model.objects.Wall;
import features.world.dungeonmap.model.structures.cluster.InternalBoundaryType;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.LocalConnection;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorBindings;
import features.world.dungeonmap.model.structures.corridor.CorridorDoorBinding;
import features.world.dungeonmap.model.structures.corridor.CorridorPlanningInput;
import features.world.dungeonmap.model.structures.corridor.CorridorWaypointBinding;
import features.world.dungeonmap.model.structures.room.RoomExitNarration;
import features.world.dungeonmap.model.structures.room.RoomNarration;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.stair.DungeonStairExit;
import features.world.dungeonmap.model.structures.stair.StairShape;
import features.world.dungeonmap.persistence.DungeonSchemaSupport;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;
import features.world.dungeonmap.model.structures.transition.DungeonTransitionDestination;
import features.world.dungeonmap.persistence.DungeonTransitionSchemaSupport;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.ArrayDeque;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class DungeonMapLoader {

    private static final Point2i LOOP_SEPARATOR = new Point2i(Integer.MIN_VALUE, Integer.MIN_VALUE);
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

    public DungeonLayout loadLayout(Connection conn, long mapId) throws SQLException {
        if (conn == null) {
            throw new IllegalArgumentException("conn darf nicht null sein");
        }
        DungeonTransitionSchemaSupport.ensureCompatibility(conn);
        List<DungeonMapCatalogEntry> maps = loadCatalog(conn);
        DungeonMapCatalogEntry map = findMap(maps, mapId);
        if (map == null) {
            return null;
        }
        return loadExistingMap(conn, maps, map).activeMap();
    }

    private static DungeonMapLoadResult loadExistingMap(
            Connection conn,
            List<DungeonMapCatalogEntry> maps,
            DungeonMapCatalogEntry map
    ) throws SQLException {
        List<Room> rooms = loadRooms(conn, map.mapId());
        List<RoomCluster> clusters = loadClusters(conn, map.mapId(), rooms);
        Map<Long, Integer> clusterLevels = loadClusterLevels(conn, map.mapId());
        Map<Long, Integer> roomLevels = loadRoomLevels(conn, map.mapId());
        return new DungeonMapLoadResult(
                maps,
                new DungeonLayout(
                        map.mapId(),
                        map.name(),
                        loadCorridors(conn, map.mapId(), clusters, roomLevels, clusterLevels),
                        clusters,
                        loadStairs(conn, map.mapId()),
                        loadTransitions(conn, map.mapId()),
                        clusterLevels,
                        roomLevels),
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

    private static Map<Long, Integer> loadClusterLevels(Connection conn, long mapId) throws SQLException {
        return loadLevelMap(conn,
                "SELECT cluster_id AS entity_id, level_z FROM dungeon_room_clusters WHERE dungeon_map_id=?",
                mapId);
    }

    private static Map<Long, Integer> loadRoomLevels(Connection conn, long mapId) throws SQLException {
        return loadLevelMap(conn,
                "SELECT room_id AS entity_id, level_z FROM dungeon_rooms WHERE dungeon_map_id=?",
                mapId);
    }

    private static Map<Long, Integer> loadLevelMap(Connection conn, String sql, long mapId) throws SQLException {
        Map<Long, Integer> result = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.put(rs.getLong("entity_id"), rs.getInt("level_z"));
                }
            }
        }
        return Map.copyOf(result);
    }

    private static List<Room> loadRooms(Connection conn, long mapId) throws SQLException {
        Map<Long, List<RoomExitNarration>> exitNarrationsByRoomId = loadGrouped(conn,
                "SELECT room_id, cell_x, cell_y, edge_direction, description"
                        + " FROM dungeon_room_exit_descriptions"
                        + " WHERE room_id IN (SELECT room_id FROM dungeon_rooms WHERE dungeon_map_id=?)"
                        + " ORDER BY room_id, sort_order, cell_y, cell_x, edge_direction",
                mapId,
                rs -> rs.getLong("room_id"),
                rs -> new RoomExitNarration(
                        new Point2i(rs.getInt("cell_x"), rs.getInt("cell_y")),
                        edgeDirectionDelta(rs.getString("edge_direction")),
                        rs.getString("description")));
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT room_id, dungeon_map_id, cluster_id, name, visual_description, component_x, component_y"
                        + " FROM dungeon_rooms WHERE dungeon_map_id=? ORDER BY room_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                List<Room> rooms = new ArrayList<>();
                while (rs.next()) {
                    long roomId = rs.getLong("room_id");
                    Point2i anchor = new Point2i(rs.getInt("component_x"), rs.getInt("component_y"));
                    rooms.add(Room.resolved(
                            roomId,
                            rs.getLong("dungeon_map_id"),
                            rs.getLong("cluster_id"),
                            normalizedRoomName(roomId, rs.getString("name")),
                            new Floor(TileShape.singleCell(anchor)),
                            List.of(),
                            new RoomNarration(
                                    rs.getString("visual_description"),
                                    exitNarrationsByRoomId.getOrDefault(roomId, List.of()))));
                }
                return List.copyOf(rooms);
            }
        }
    }

    private static List<Corridor> loadCorridors(
            Connection conn,
            long mapId,
            List<RoomCluster> clusters,
            Map<Long, Integer> roomLevels,
            Map<Long, Integer> clusterLevels
    ) throws SQLException {
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
        Map<Long, List<CorridorWaypointBinding>> waypointBindingsByCorridor = loadGrouped(conn,
                "SELECT corridor_id, cluster_id, relative_x, relative_y, relative_z"
                        + " FROM dungeon_corridor_waypoints"
                        + " WHERE corridor_id IN (SELECT corridor_id FROM dungeon_corridors WHERE dungeon_map_id=?)"
                        + " ORDER BY corridor_id, sort_order",
                mapId,
                rs -> rs.getLong("corridor_id"),
                rs -> new CorridorWaypointBinding(
                        rs.getLong("cluster_id"),
                        new Point2i(rs.getInt("relative_x"), rs.getInt("relative_y")),
                        rs.getInt("relative_z")));
        Map<Long, List<CorridorDoorBinding>> doorBindingsByCorridor = loadGrouped(conn,
                "SELECT corridor_id, room_id, cluster_id, relative_cell_x, relative_cell_y, edge_direction"
                        + " FROM dungeon_corridor_door_overrides"
                        + " WHERE corridor_id IN (SELECT corridor_id FROM dungeon_corridors WHERE dungeon_map_id=?)"
                        + " ORDER BY corridor_id, sort_order, room_id",
                mapId,
                rs -> rs.getLong("corridor_id"),
                rs -> new CorridorDoorBinding(
                        rs.getLong("room_id"),
                        rs.getLong("cluster_id"),
                        new Point2i(rs.getInt("relative_cell_x"), rs.getInt("relative_cell_y")),
                        edgeDirectionDelta(rs.getString("edge_direction"))));
        List<Corridor> result = new ArrayList<>();
        for (Map.Entry<Long, List<Long>> entry : roomIdsByCorridor.entrySet()) {
            result.add(Corridor.resolved(
                    entry.getKey(),
                    mapId,
                    entry.getValue(),
                    new CorridorBindings(
                            waypointBindingsByCorridor.getOrDefault(entry.getKey(), List.of()),
                            doorBindingsByCorridor.getOrDefault(entry.getKey(), List.of())),
                    CorridorPath.empty(),
                    List.of()));
        }
        CorridorPlanningInput planningInput = CorridorPlanningInputProjector.project(
                clusters,
                roomLevels,
                clusterLevels);
        return result.stream()
                .map(corridor -> corridor == null ? null : corridor.replanned(planningInput))
                .toList();
    }

    private static List<DungeonStair> loadStairs(Connection conn, long mapId) throws SQLException {
        DungeonSchemaSupport.ensureCompatibility(conn);
        Map<Long, List<CubePoint>> pathNodesByStairId = loadGrouped(conn,
                "SELECT stair_id, cell_x, cell_y, cell_z"
                        + " FROM dungeon_stair_path_nodes"
                        + " WHERE stair_id IN (SELECT stair_id FROM dungeon_stairs WHERE dungeon_map_id=?)"
                        + " ORDER BY stair_id, sort_order",
                mapId,
                rs -> rs.getLong("stair_id"),
                rs -> new CubePoint(rs.getInt("cell_x"), rs.getInt("cell_y"), rs.getInt("cell_z")));
        Map<Long, List<DungeonStairExit>> exitsByStairId = loadGrouped(conn,
                "SELECT stair_id, stair_exit_id, cell_x, cell_y, cell_z, label"
                        + " FROM dungeon_stair_exits"
                        + " WHERE stair_id IN (SELECT stair_id FROM dungeon_stairs WHERE dungeon_map_id=?)"
                        + " ORDER BY stair_id, stair_exit_id",
                mapId,
                rs -> rs.getLong("stair_id"),
                rs -> new DungeonStairExit(
                        rs.getLong("stair_exit_id"),
                        new CubePoint(rs.getInt("cell_x"), rs.getInt("cell_y"), rs.getInt("cell_z")),
                        rs.getString("label")));
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT stair_id, dungeon_map_id, name, shape, direction, dimension1, dimension2"
                        + " FROM dungeon_stairs WHERE dungeon_map_id=? ORDER BY stair_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                List<DungeonStair> result = new ArrayList<>();
                while (rs.next()) {
                    long stairId = rs.getLong("stair_id");
                    result.add(new DungeonStair(
                            stairId,
                            rs.getLong("dungeon_map_id"),
                            rs.getString("name"),
                            StairShape.parse(rs.getString("shape")),
                            CardinalDirection.fromCode(rs.getInt("direction")),
                            rs.getInt("dimension1"),
                            rs.getInt("dimension2"),
                            pathNodesByStairId.getOrDefault(stairId, List.of()),
                            exitsByStairId.getOrDefault(stairId, List.of())));
                }
                return List.copyOf(result);
            }
        }
    }

    private static List<DungeonTransition> loadTransitions(Connection conn, long mapId) throws SQLException {
        DungeonTransitionSchemaSupport.ensureCompatibility(conn);
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT transition_id, dungeon_map_id, description, cell_x, cell_y, level_z, destination_type,"
                        + " target_overworld_map_id, target_overworld_tile_id, target_dungeon_map_id,"
                        + " target_transition_id, linked_transition_id"
                        + " FROM dungeon_transitions WHERE dungeon_map_id=? ORDER BY transition_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                List<DungeonTransition> result = new ArrayList<>();
                while (rs.next()) {
                    CubePoint anchor = rs.getObject("cell_x") == null
                            ? null
                            : new CubePoint(rs.getInt("cell_x"), rs.getInt("cell_y"), rs.getInt("level_z"));
                    String destinationType = rs.getString("destination_type");
                    DungeonTransitionDestination destination = "DUNGEON_MAP".equals(destinationType)
                            ? new DungeonTransitionDestination.DungeonMapDestination(
                            rs.getLong("target_dungeon_map_id"),
                            nullableLong(rs, "target_transition_id"))
                            : new DungeonTransitionDestination.OverworldTileDestination(
                            rs.getLong("target_overworld_map_id"),
                            rs.getLong("target_overworld_tile_id"));
                    result.add(new DungeonTransition(
                            rs.getLong("transition_id"),
                            rs.getLong("dungeon_map_id"),
                            rs.getString("description"),
                            anchor,
                            destination,
                            nullableLong(rs, "linked_transition_id")));
                }
                return List.copyOf(result);
            }
        }
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

        Map<Long, Point2i> centersByClusterId = loadClusterCenters(conn, mapId);
        Map<Long, List<EdgeObject>> edgesByClusterId = loadGrouped(conn,
                "SELECT cluster_id, cell_x, cell_y, edge_direction, edge_type FROM dungeon_room_cluster_edges"
                        + " WHERE cluster_id IN (SELECT cluster_id FROM dungeon_room_clusters WHERE dungeon_map_id=?)"
                        + " ORDER BY cluster_id, cell_y, cell_x, edge_direction",
                mapId,
                rs -> rs.getLong("cluster_id"),
                rs -> edgeObjectRelativeToCenter(
                        new Point2i(rs.getInt("cell_x"), rs.getInt("cell_y")),
                        centersByClusterId.get(rs.getLong("cluster_id")),
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
                    Set<Point2i> clusterCells = tileShapeFromRelativeVertices(
                            new Point2i(rs.getInt("center_x"), rs.getInt("center_y")),
                            List.copyOf(verticesByClusterId.getOrDefault(clusterId, List.of())))
                            .absoluteCells();
                    List<Room> hydratedRooms = hydrateRooms(
                            clusterId,
                            clusterCells,
                            edgeObjects,
                            roomsByClusterId.getOrDefault(clusterId, List.of()));
                    clusters.add(new RoomCluster(
                            clusterId,
                            rs.getLong("dungeon_map_id"),
                            centersByClusterId.getOrDefault(clusterId, new Point2i(rs.getInt("center_x"), rs.getInt("center_y"))),
                            hydratedRooms,
                            materializeLocalConnections(rs.getLong("dungeon_map_id"), clusterId, hydratedRooms, edgeObjects)));
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

    private static Map<Long, Point2i> loadClusterCenters(Connection conn, long mapId) throws SQLException {
        Map<Long, Point2i> result = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT cluster_id, center_x, center_y FROM dungeon_room_clusters"
                        + " WHERE dungeon_map_id=? ORDER BY cluster_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.put(rs.getLong("cluster_id"), new Point2i(rs.getInt("center_x"), rs.getInt("center_y")));
                }
            }
        }
        return Map.copyOf(result);
    }

    private static List<Room> hydrateRooms(
            long clusterId,
            Set<Point2i> clusterCells,
            List<EdgeObject> edgeObjects,
            List<Room> rooms
    ) {
        // Persistence stores cluster topology in aggregate form; after loading, each room owns its runtime shape
        // and its touching boundary objects so later editor mutations can stay room-local by default.
        if (rooms == null || rooms.isEmpty()) {
            return List.of();
        }
        List<VertexPath> barriers = barriers(edgeObjects);
        Set<Point2i> unclaimedCells = new LinkedHashSet<>(clusterCells);
        List<Room> hydratedRooms = new ArrayList<>();
        for (Room room : rooms) {
            if (room == null || room.roomId() == null) {
                continue;
            }
            Point2i anchor = room.floor().shape().anchor();
            if (!clusterCells.contains(anchor)) {
                throw new IllegalStateException(
                        "Raum " + room.roomId() + " hat einen Anker ausserhalb von Cluster " + clusterId);
            }
            if (!unclaimedCells.contains(anchor)) {
                throw new IllegalStateException(
                        "Raum " + room.roomId() + " teilt sich einen offenen Bereich in Cluster " + clusterId);
            }
            Set<Point2i> roomCells = reachableCells(anchor, unclaimedCells, barriers);
            if (roomCells.isEmpty()) {
                throw new IllegalStateException(
                        "Raum " + room.roomId() + " konnte in Cluster " + clusterId + " nicht hydriert werden");
            }
            unclaimedCells.removeAll(roomCells);
            hydratedRooms.add(Room.resolved(
                    room.roomId(),
                    room.mapId(),
                    room.clusterId(),
                    room.name(),
                    new Floor(TileShape.fromAbsoluteCells(roomCells)),
                    wallsForRoom(clusterCells, roomCells, edgeObjects),
                    room.narration()));
        }
        if (!unclaimedCells.isEmpty()) {
            throw new IllegalStateException(
                    "Cluster " + clusterId + " enthaelt Zellen ohne Raumankerzuordnung");
        }
        return List.copyOf(hydratedRooms);
    }

    private static List<VertexPath> barriers(List<EdgeObject> edgeObjects) {
        List<VertexPath> result = new ArrayList<>(edgeObjects.size());
        for (EdgeObject edgeObject : edgeObjects) {
            if (edgeObject == null || edgeObject.edge() == null) {
                continue;
            }
            if (edgeObject.isWall()) {
                result.add(new Wall(Set.of(edgeObject.edge())));
            }
            if (edgeObject.isDoor()) {
                result.add(new Door(Set.of(edgeObject.edge())));
            }
        }
        return List.copyOf(result);
    }

    private static Set<Point2i> reachableCells(
            Point2i startAnchor,
            Set<Point2i> traversableCells,
            List<VertexPath> barriers
    ) {
        Set<Point2i> visited = new LinkedHashSet<>();
        Set<Point2i> frontier = new LinkedHashSet<>(traversableCells);
        ArrayDeque<Point2i> queue = new ArrayDeque<>();
        queue.add(startAnchor);
        frontier.remove(startAnchor);
        while (!queue.isEmpty()) {
            Point2i current = queue.removeFirst();
            visited.add(current);
            for (Point2i step : Point2i.CARDINAL_STEPS) {
                Point2i neighbor = current.add(step);
                if (!frontier.contains(neighbor) || isBlocked(barriers, current, step)) {
                    continue;
                }
                frontier.remove(neighbor);
                queue.addLast(neighbor);
            }
        }
        return Set.copyOf(visited);
    }

    private static boolean isBlocked(List<VertexPath> barriers, Point2i cell, Point2i step) {
        for (VertexPath barrier : barriers) {
            if (barrier != null && barrier.crosses(cell, step)) {
                return true;
            }
        }
        return false;
    }

    private static List<Wall> wallsForRoom(Set<Point2i> clusterCells, Set<Point2i> roomCells, List<EdgeObject> edgeObjects) {
        Set<VertexEdge> walls = new LinkedHashSet<>();
        for (Point2i cell : roomCells) {
            for (Point2i step : Point2i.CARDINAL_STEPS) {
                Point2i neighbor = cell.add(step);
                if (roomCells.contains(neighbor)) {
                    continue;
                }
                VertexEdge edge = VertexEdge.betweenCellAndStep(cell, step);
                if (!clusterCells.contains(neighbor)) {
                    walls.add(edge);
                }
            }
        }
        for (EdgeObject edgeObject : edgeObjects) {
            if (edgeObject != null && edgeObject.isWall() && touchesRoom(roomCells, edgeObject.edge())) {
                walls.add(edgeObject.edge());
            }
        }
        return walls.isEmpty() ? List.of() : List.of(new Wall(walls));
    }

    private static List<LocalConnection> materializeLocalConnections(
            long mapId,
            long clusterId,
            List<Room> rooms,
            List<EdgeObject> edgeObjects
    ) {
        Map<Point2i, Room> roomsByCell = new LinkedHashMap<>();
        for (Room room : rooms) {
            if (room == null) {
                continue;
            }
            for (Point2i cell : room.cells()) {
                roomsByCell.put(cell, room);
            }
        }
        List<LocalConnection> result = new ArrayList<>();
        for (EdgeObject edgeObject : edgeObjects) {
            if (edgeObject == null || !edgeObject.isDoor() || edgeObject.edge() == null) {
                continue;
            }
            LocalConnection connection = materializeLocalConnection(mapId, clusterId, edgeObject.edge(), roomsByCell);
            if (connection != null) {
                result.add(connection);
            }
        }
        return List.copyOf(result);
    }

    private static LocalConnection materializeLocalConnection(
            long mapId,
            long clusterId,
            VertexEdge edge,
            Map<Point2i, Room> roomsByCell
    ) {
        if (edge == null) {
            return null;
        }
        List<Point2i> touchingCells = edge.touchingCells().stream()
                .sorted(Point2i.POINT_ORDER)
                .toList();
        if (touchingCells.isEmpty() || touchingCells.size() > 2) {
            return null;
        }
        List<Room> touchingRooms = touchingCells.stream()
                .map(roomsByCell::get)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .toList();
        if (touchingRooms.isEmpty()) {
            return null;
        }
        List<ConnectionEndpoint> endpoints = endpointsForDoor(clusterId, touchingRooms);
        if (endpoints.size() != 2) {
            return null;
        }
        return new LocalConnection(
                null,
                mapId,
                clusterId,
                new Door(Set.of(edge)),
                endpoints);
    }

    private static List<ConnectionEndpoint> endpointsForDoor(long clusterId, List<Room> touchingRooms) {
        if (touchingRooms == null || touchingRooms.isEmpty()) {
            return List.of();
        }
        if (touchingRooms.size() >= 2) {
            Room leftRoom = touchingRooms.getFirst();
            Room rightRoom = touchingRooms.get(1);
            if (leftRoom.roomId() == null || rightRoom.roomId() == null || leftRoom.roomId().equals(rightRoom.roomId())) {
                return List.of();
            }
            return List.of(ConnectionEndpoint.room(leftRoom.roomId()), ConnectionEndpoint.room(rightRoom.roomId()));
        }
        Room room = touchingRooms.getFirst();
        if (room.roomId() == null) {
            return List.of();
        }
        return List.of(ConnectionEndpoint.room(room.roomId()), ConnectionEndpoint.cluster(clusterId));
    }

    private static boolean touchesRoom(Set<Point2i> roomCells, VertexPath boundary) {
        for (VertexEdge edge : boundary.edges()) {
            if (touchesRoom(roomCells, edge)) {
                return true;
            }
        }
        return false;
    }

    private static boolean touchesRoom(Set<Point2i> roomCells, VertexEdge edge) {
        for (Point2i cell : roomCells) {
            for (Point2i step : Point2i.CARDINAL_STEPS) {
                Point2i neighbor = cell.add(step);
                if (roomCells.contains(neighbor)) {
                    continue;
                }
                if (VertexEdge.betweenCellAndStep(cell, step).equals(edge)) {
                    return true;
                }
            }
        }
        return false;
    }

    @FunctionalInterface
    private interface ResultSetMapper<T> {
        T map(ResultSet rs) throws SQLException;
    }

    private static String normalizedRoomName(long roomId, String name) {
        return name == null || name.isBlank() ? "Raum " + roomId : name.trim();
    }

    private static Point2i edgeDirectionDelta(String direction) {
        if (direction == null) {
            return new Point2i(0, 0);
        }
        return switch (direction.trim().toUpperCase()) {
            case "NORTH" -> new Point2i(0, -1);
            case "EAST" -> new Point2i(1, 0);
            case "SOUTH" -> new Point2i(0, 1);
            case "WEST" -> new Point2i(-1, 0);
            default -> throw new IllegalArgumentException("Unbekannte Korridor-Tuerrichtung: " + direction);
        };
    }

    private static EdgeObject edgeObjectRelativeToCenter(Point2i relativeCell, Point2i center, String direction, String type) {
        Point2i absoluteCell = (relativeCell == null ? new Point2i(0, 0) : relativeCell)
                .add(center == null ? new Point2i(0, 0) : center);
        return edgeObject(absoluteCell, direction, type);
    }

    private static EdgeObject edgeObject(Point2i cell, String direction, String type) {
        Point2i delta = switch (direction) {
            case "NORTH" -> new Point2i(0, -1);
            case "EAST" -> new Point2i(1, 0);
            case "SOUTH" -> new Point2i(0, 1);
            case "WEST" -> new Point2i(-1, 0);
            default -> throw new IllegalArgumentException("Unbekannte Kantenrichtung: " + direction);
        };
        VertexEdge edge = VertexEdge.betweenCellAndStep(cell, delta);
        return new EdgeObject(edge, "DOOR".equals(type) ? InternalBoundaryType.DOOR : InternalBoundaryType.WALL);
    }

    private static TileShape tileShapeFromRelativeVertices(Point2i anchor, List<Point2i> relativeVertices) {
        List<List<Point2i>> loops = splitLoops(relativeVertices);
        if (loops.isEmpty()) {
            return TileShape.singleCell(anchor);
        }
        int minX = loops.stream().flatMap(List::stream).mapToInt(Point2i::x).min().orElse(0);
        int maxX = loops.stream().flatMap(List::stream).mapToInt(Point2i::x).max().orElse(0);
        int minY = loops.stream().flatMap(List::stream).mapToInt(Point2i::y).min().orElse(0);
        int maxY = loops.stream().flatMap(List::stream).mapToInt(Point2i::y).max().orElse(0);

        Set<Point2i> absoluteCells = new LinkedHashSet<>();
        for (int x = minX; x <= maxX; x++) {
            for (int y = minY; y <= maxY; y++) {
                if (containsCell(loops, x, y)) {
                    absoluteCells.add(anchor.add(new Point2i(x, y)));
                }
            }
        }
        return TileShape.fromAbsoluteCells(anchor, absoluteCells);
    }

    private static List<List<Point2i>> splitLoops(List<Point2i> vertices) {
        List<List<Point2i>> loops = new ArrayList<>();
        List<Point2i> currentLoop = new ArrayList<>();
        for (Point2i vertex : vertices == null ? List.<Point2i>of() : vertices) {
            if (LOOP_SEPARATOR.equals(vertex)) {
                if (!currentLoop.isEmpty()) {
                    loops.add(List.copyOf(currentLoop));
                    currentLoop = new ArrayList<>();
                }
                continue;
            }
            currentLoop.add(vertex);
        }
        if (!currentLoop.isEmpty()) {
            loops.add(List.copyOf(currentLoop));
        }
        return loops.isEmpty() ? List.of() : List.copyOf(loops);
    }

    private static boolean containsCell(List<List<Point2i>> loops, int x, int y) {
        boolean inside = false;
        for (List<Point2i> loop : loops) {
            if (polygonContainsCell(loop, x, y)) {
                inside = !inside;
            }
        }
        return inside;
    }

    private static boolean polygonContainsCell(List<Point2i> polygon, int x, int y) {
        double px = x + 0.5;
        double py = y + 0.5;
        boolean inside = false;
        for (int i = 0, j = polygon.size() - 1; i < polygon.size(); j = i++) {
            Point2i pi = polygon.get(i);
            Point2i pj = polygon.get(j);
            boolean intersects = ((pi.y() > py) != (pj.y() > py))
                    && (px < (double) (pj.x() - pi.x()) * (py - pi.y()) / (double) (pj.y() - pi.y()) + pi.x());
            if (intersects) {
                inside = !inside;
            }
        }
        return inside;
    }

    private static Long nullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }

    private record EdgeObject(VertexEdge edge, InternalBoundaryType type) {
        boolean isWall() {
            return type == InternalBoundaryType.WALL;
        }

        boolean isDoor() {
            return type == InternalBoundaryType.DOOR;
        }
    }
}
