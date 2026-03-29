package features.world.dungeonmap.loading;

import database.DatabaseManager;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.TraversalPlanningInputProjector;
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
import features.world.dungeonmap.model.structures.corridor.CorridorWaypointBinding;
import features.world.dungeonmap.model.structures.room.RoomExitNarration;
import features.world.dungeonmap.model.structures.room.RoomNarration;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.stair.DungeonStairExit;
import features.world.dungeonmap.model.structures.stair.StairShape;
import features.world.dungeonmap.model.structures.traversal.TraversalCorridorSegment;
import features.world.dungeonmap.model.structures.traversal.TraversalMaterialization;
import features.world.dungeonmap.model.structures.traversal.CorridorTraversalSlice;
import features.world.dungeonmap.model.structures.traversal.TraversalPlan;
import features.world.dungeonmap.model.structures.traversal.TraversalStairSegment;
import features.world.dungeonmap.model.structures.traversal.Traversal;
import features.world.dungeonmap.model.structures.traversal.TraversalPlanningInput;
import features.world.dungeonmap.model.structures.traversal.planning.TraversalPlanningEngine;
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
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
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
            LoadedCatalog loadedCatalog = loadUsableCatalog(conn, maps);
            if (loadedCatalog.usableMaps().isEmpty()) {
                return new DungeonMapLoadResult(List.of(), null, loadedCatalog.failureMessage());
            }
            DungeonMapCatalogEntry firstUsableMap = loadedCatalog.usableMaps().getFirst();
            return new DungeonMapLoadResult(
                    loadedCatalog.allMaps(),
                    loadedCatalog.layoutsById().get(firstUsableMap.mapId()),
                    loadedCatalog.failureMessage());
        }
    }

    public DungeonMapLoadResult loadMap(long mapId, List<DungeonMapCatalogEntry> fallbackMaps) throws SQLException {
        try (Connection conn = DatabaseManager.getConnection()) {
            List<DungeonMapCatalogEntry> maps = loadCatalog(conn);
            LoadedCatalog loadedCatalog = loadUsableCatalog(conn, maps);
            DungeonMapCatalogEntry requestedMap = findMap(maps, mapId);
            if (requestedMap == null) {
                return fallbackResult(
                        loadedCatalog,
                        fallbackMaps,
                        "Dungeon " + mapId + " existiert nicht mehr");
            }
            DungeonLayout requestedLayout = loadedCatalog.layoutsById().get(mapId);
            if (requestedLayout == null) {
                return fallbackResult(
                        loadedCatalog,
                        fallbackMaps,
                        "Dungeon " + requestedMap.name() + " konnte nicht geladen werden");
            }
            return new DungeonMapLoadResult(
                    loadedCatalog.allMaps(),
                    requestedLayout,
                    loadedCatalog.failureMessage());
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
        try {
            return loadLayoutOrThrow(conn, map);
        } catch (RuntimeException exception) {
            return null;
        }
    }

    public DungeonLayout loadFirstUsableLayout(Connection conn) throws SQLException {
        if (conn == null) {
            throw new IllegalArgumentException("conn darf nicht null sein");
        }
        List<DungeonMapCatalogEntry> maps = loadCatalog(conn);
        LoadedCatalog loadedCatalog = loadUsableCatalog(conn, maps);
        if (loadedCatalog.usableMaps().isEmpty()) {
            return null;
        }
        return loadedCatalog.layoutsById().get(loadedCatalog.usableMaps().getFirst().mapId());
    }

    private static DungeonMapLoadResult loadExistingMap(
            Connection conn,
            List<DungeonMapCatalogEntry> maps,
            DungeonMapCatalogEntry map
    ) throws SQLException {
        return new DungeonMapLoadResult(maps, loadLayoutOrThrow(conn, map), null);
    }

    private static DungeonLayout loadLayoutOrThrow(Connection conn, DungeonMapCatalogEntry map) throws SQLException {
        List<Room> rooms = loadRooms(conn, map.mapId());
        List<RoomCluster> clusters = loadClusters(conn, map.mapId(), rooms);
        Map<Long, Integer> clusterLevels = loadClusterLevels(conn, map.mapId());
        List<Traversal> traversals = loadTraversals(conn, map.mapId());
        List<DungeonStair> stairs = loadStairs(conn, map.mapId());
        traversals = attachStairSegments(traversals, stairs);
        List<Corridor> corridors = loadCorridors(conn, map.mapId(), traversals, clusters);
        return new DungeonLayout(
                map.mapId(),
                map.name(),
                traversals,
                corridors,
                clusters,
                stairs,
                loadTransitions(conn, map.mapId()),
                clusterLevels);
    }

    private static LoadedCatalog loadUsableCatalog(Connection conn, List<DungeonMapCatalogEntry> maps) throws SQLException {
        List<DungeonMapCatalogEntry> usableMaps = new ArrayList<>();
        Map<Long, DungeonLayout> layoutsById = new LinkedHashMap<>();
        Map<DungeonMapCatalogEntry, String> failuresByMap = new LinkedHashMap<>();
        for (DungeonMapCatalogEntry map : maps) {
            if (map == null) {
                continue;
            }
            try {
                DungeonLayout layout = loadLayoutOrThrow(conn, map);
                usableMaps.add(map);
                layoutsById.put(map.mapId(), layout);
            } catch (RuntimeException exception) {
                failuresByMap.put(map, loadFailureMessage(exception));
            }
        }
        return new LoadedCatalog(
                List.copyOf(maps),
                List.copyOf(usableMaps),
                Map.copyOf(layoutsById),
                Map.copyOf(failuresByMap));
    }

    private static DungeonMapLoadResult fallbackResult(
            LoadedCatalog loadedCatalog,
            List<DungeonMapCatalogEntry> fallbackMaps,
            String primaryMessage
    ) {
        String message = combineMessages(primaryMessage, loadedCatalog.failureMessage());
        if (!loadedCatalog.usableMaps().isEmpty()) {
            DungeonMapCatalogEntry fallbackMap = fallbackSelection(loadedCatalog.usableMaps(), fallbackMaps);
            return new DungeonMapLoadResult(
                    loadedCatalog.allMaps(),
                    loadedCatalog.layoutsById().get(fallbackMap.mapId()),
                    message);
        }
        return new DungeonMapLoadResult(loadedCatalog.allMaps(), null, message);
    }

    private static DungeonMapCatalogEntry fallbackSelection(
            List<DungeonMapCatalogEntry> usableMaps,
            List<DungeonMapCatalogEntry> fallbackMaps
    ) {
        if (fallbackMaps != null) {
            for (DungeonMapCatalogEntry fallbackMap : fallbackMaps) {
                if (fallbackMap == null) {
                    continue;
                }
                for (DungeonMapCatalogEntry usableMap : usableMaps) {
                    if (usableMap != null && usableMap.mapId() == fallbackMap.mapId()) {
                        return usableMap;
                    }
                }
            }
        }
        return usableMaps.getFirst();
    }

    private static String combineMessages(String primaryMessage, String secondaryMessage) {
        if (primaryMessage == null || primaryMessage.isBlank()) {
            return secondaryMessage;
        }
        if (secondaryMessage == null || secondaryMessage.isBlank()) {
            return primaryMessage;
        }
        return primaryMessage + " " + secondaryMessage;
    }

    private static String loadFailureMessage(RuntimeException exception) {
        String message = exception.getMessage();
        if (message != null && !message.isBlank()) {
            return message;
        }
        return exception.getClass().getSimpleName();
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
        Map<Long, Map<Integer, Point2i>> additionalAnchorsByRoomId = loadRoomFloorAnchors(conn, mapId);
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
                "SELECT room_id, dungeon_map_id, cluster_id, name, visual_description, component_x, component_y, level_z"
                        + " FROM dungeon_rooms WHERE dungeon_map_id=? ORDER BY room_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                List<Room> rooms = new ArrayList<>();
                while (rs.next()) {
                    long roomId = rs.getLong("room_id");
                    int primaryLevel = rs.getInt("level_z");
                    Point2i primaryAnchor = new Point2i(rs.getInt("component_x"), rs.getInt("component_y"));
                    Map<Integer, Floor> floors = new LinkedHashMap<>();
                    floors.put(primaryLevel, new Floor(TileShape.singleCell(primaryAnchor)));
                    for (Map.Entry<Integer, Point2i> entry : additionalAnchorsByRoomId.getOrDefault(roomId, Map.of()).entrySet()) {
                        floors.put(entry.getKey(), new Floor(TileShape.singleCell(entry.getValue())));
                    }
                    rooms.add(Room.resolved(
                            roomId,
                            rs.getLong("dungeon_map_id"),
                            rs.getLong("cluster_id"),
                            normalizedRoomName(roomId, rs.getString("name")),
                            floors,
                            List.of(),
                            new RoomNarration(
                                    rs.getString("visual_description"),
                                    exitNarrationsByRoomId.getOrDefault(roomId, List.of()))));
                }
                return List.copyOf(rooms);
            }
        }
    }

    private static List<Traversal> loadTraversals(Connection conn, long mapId) throws SQLException {
        Map<Long, List<Long>> roomIdsByTraversal = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT t.traversal_id, m.room_id"
                        + " FROM dungeon_traversals t"
                        + " LEFT JOIN dungeon_traversal_members m ON m.traversal_id=t.traversal_id"
                        + " WHERE t.dungeon_map_id=?"
                        + " ORDER BY t.traversal_id, m.member_order, m.room_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long traversalId = rs.getLong("traversal_id");
                    roomIdsByTraversal.computeIfAbsent(traversalId, ignored -> new ArrayList<>());
                    long roomId = rs.getLong("room_id");
                    if (!rs.wasNull()) {
                        roomIdsByTraversal.get(traversalId).add(roomId);
                    }
                }
                Map<Long, List<CorridorWaypointBinding>> waypointBindingsByTraversal = loadGrouped(conn,
                        "SELECT traversal_id, cluster_id, relative_x, relative_y, relative_z"
                                + " FROM dungeon_traversal_waypoints"
                                + " WHERE traversal_id IN (SELECT traversal_id FROM dungeon_traversals WHERE dungeon_map_id=?)"
                                + " ORDER BY traversal_id, sort_order",
                        mapId,
                        row -> row.getLong("traversal_id"),
                        row -> new CorridorWaypointBinding(
                                row.getLong("cluster_id"),
                                new Point2i(row.getInt("relative_x"), row.getInt("relative_y")),
                                row.getInt("relative_z")));
                Map<Long, List<CorridorDoorBinding>> doorBindingsByTraversal = loadGrouped(conn,
                        "SELECT traversal_id, room_id, cluster_id, relative_cell_x, relative_cell_y, edge_direction"
                                + " FROM dungeon_traversal_door_bindings"
                                + " WHERE traversal_id IN (SELECT traversal_id FROM dungeon_traversals WHERE dungeon_map_id=?)"
                                + " ORDER BY traversal_id, sort_order, room_id",
                        mapId,
                        row -> row.getLong("traversal_id"),
                        row -> new CorridorDoorBinding(
                                row.getLong("room_id"),
                                row.getLong("cluster_id"),
                                new Point2i(row.getInt("relative_cell_x"), row.getInt("relative_cell_y")),
                                edgeDirectionDelta(row.getString("edge_direction"))));
                Map<Long, List<TraversalCorridorSegment>> corridorSegmentsByTraversal = loadGrouped(conn,
                        "SELECT traversal_id, corridor_id, segment_key"
                                + " FROM dungeon_corridors"
                                + " WHERE traversal_id IN (SELECT traversal_id FROM dungeon_traversals WHERE dungeon_map_id=?)"
                                + " ORDER BY traversal_id, corridor_id",
                        mapId,
                        row -> row.getLong("traversal_id"),
                        row -> new TraversalCorridorSegment(
                                normalizedSegmentKey(row.getString("segment_key"), "legacy-corridor"),
                                row.getLong("corridor_id")));
                List<Traversal> result = new ArrayList<>();
                for (Map.Entry<Long, List<Long>> entry : roomIdsByTraversal.entrySet()) {
                    result.add(Traversal.resolved(
                            entry.getKey(),
                            mapId,
                            entry.getValue(),
                            new CorridorBindings(
                                    waypointBindingsByTraversal.getOrDefault(entry.getKey(), List.of()),
                                    doorBindingsByTraversal.getOrDefault(entry.getKey(), List.of())),
                            new TraversalMaterialization(
                                    corridorSegmentsByTraversal.getOrDefault(entry.getKey(), List.of()),
                                    List.of())));
                }
                return List.copyOf(result);
            }
        }
    }

    private static List<Corridor> loadCorridors(
            Connection conn,
            long mapId,
            List<Traversal> traversals,
            List<RoomCluster> clusters
    ) throws SQLException {
        TraversalPlanningInput planningInput = TraversalPlanningInputProjector.project(clusters);
        ArrayList<Corridor> result = new ArrayList<>();
        for (Traversal traversal : traversals) {
            if (traversal == null || traversal.corridorSegments().isEmpty()) {
                continue;
            }
            TraversalPlan traversalPlan = TraversalPlanningEngine.plan(traversal, planningInput)
                    .withCorridorIds(traversal.materialization().corridorIdsBySegmentKey());
            for (TraversalCorridorSegment corridorSegment : traversal.corridorSegments()) {
                if (corridorSegment == null || corridorSegment.corridorId() == null) {
                    continue;
                }
                CorridorTraversalSlice slice = traversalPlan.corridorSliceBySegmentKey(corridorSegment.segmentKey());
                result.add(Corridor.resolved(
                        corridorSegment.segmentKey(),
                        corridorSegment.corridorId(),
                        traversal.traversalId(),
                        mapId,
                        traversal.roomIds(),
                        traversal.bindings(),
                        slice == null ? CorridorPath.empty() : slice.path(),
                        slice == null ? List.of() : slice.connections()));
            }
        }
        return List.copyOf(result);
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
                "SELECT stair_id, traversal_id, segment_key, dungeon_map_id, name, shape, direction, dimension1, dimension2"
                        + " FROM dungeon_stairs WHERE dungeon_map_id=? ORDER BY stair_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                List<DungeonStair> result = new ArrayList<>();
                while (rs.next()) {
                    long stairId = rs.getLong("stair_id");
                    long rawTraversalId = rs.getLong("traversal_id");
                    Long traversalId = rs.wasNull() ? null : rawTraversalId;
                    result.add(new DungeonStair(
                            stairId,
                            traversalId,
                            rs.getString("segment_key"),
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

    private static List<Traversal> attachStairSegments(List<Traversal> traversals, List<DungeonStair> stairs) {
        if (traversals == null || traversals.isEmpty()) {
            return List.of();
        }
        Map<Long, List<TraversalStairSegment>> stairSegmentsByTraversal = new LinkedHashMap<>();
        for (DungeonStair stair : stairs == null ? List.<DungeonStair>of() : stairs) {
            if (stair == null || stair.traversalId() == null) {
                continue;
            }
            stairSegmentsByTraversal.computeIfAbsent(stair.traversalId(), ignored -> new ArrayList<>())
                    .add(new TraversalStairSegment(stair.segmentKey(), stair.stairId()));
        }
        ArrayList<Traversal> updated = new ArrayList<>();
        for (Traversal traversal : traversals) {
            if (traversal == null || traversal.traversalId() == null) {
                updated.add(traversal);
                continue;
            }
            updated.add(traversal.withMaterialization(traversal.materialization().withStairSegments(
                    stairSegmentsByTraversal.getOrDefault(traversal.traversalId(), List.of()))));
        }
        return List.copyOf(updated);
    }

    private static String normalizedSegmentKey(String rawSegmentKey, String fallbackPrefix) {
        if (rawSegmentKey != null && !rawSegmentKey.isBlank()) {
            return rawSegmentKey;
        }
        return fallbackPrefix;
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

    private static Map<Long, Map<Integer, Point2i>> loadRoomFloorAnchors(Connection conn, long mapId) throws SQLException {
        Map<Long, Map<Integer, Point2i>> result = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT room_id, level_z, anchor_x, anchor_y"
                        + " FROM dungeon_room_floors"
                        + " WHERE room_id IN (SELECT room_id FROM dungeon_rooms WHERE dungeon_map_id=?)"
                        + " ORDER BY room_id, level_z")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.computeIfAbsent(rs.getLong("room_id"), ignored -> new LinkedHashMap<>())
                            .put(rs.getInt("level_z"), new Point2i(rs.getInt("anchor_x"), rs.getInt("anchor_y")));
                }
            }
        }
        return copyNestedMap(result);
    }

    private static List<RoomCluster> loadClusters(Connection conn, long mapId, List<Room> rooms) throws SQLException {
        Map<Long, Map<Integer, List<Point2i>>> verticesByClusterId = loadClusterVerticesByLevel(conn, mapId);
        Map<Long, Point2i> centersByClusterId = loadClusterCenters(conn, mapId);
        Map<Long, Map<Integer, List<EdgeObject>>> edgesByClusterId = loadClusterEdgesByLevel(conn, mapId, centersByClusterId);

        List<RoomCluster> clusters = new ArrayList<>();
        Map<Long, List<Room>> roomsByClusterId = roomsByClusterId(rooms);
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT cluster_id, dungeon_map_id, center_x, center_y FROM dungeon_room_clusters"
                        + " WHERE dungeon_map_id=? ORDER BY cluster_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long clusterId = rs.getLong("cluster_id");
                    Point2i center = centersByClusterId.getOrDefault(clusterId, new Point2i(rs.getInt("center_x"), rs.getInt("center_y")));
                    Map<Integer, TileShape> clusterShapesByLevel = clusterShapesByLevel(
                            center,
                            verticesByClusterId.getOrDefault(clusterId, Map.of()));
                    Map<Integer, List<EdgeObject>> edgeObjectsByLevel = edgesByClusterId.getOrDefault(clusterId, Map.of());
                    List<Room> hydratedRooms = hydrateRooms(
                            clusterId,
                            clusterShapesByLevel,
                            edgeObjectsByLevel,
                            roomsByClusterId.getOrDefault(clusterId, List.of()));
                    clusters.add(new RoomCluster(
                            clusterId,
                            rs.getLong("dungeon_map_id"),
                            center,
                            hydratedRooms,
                            materializeLocalConnections(
                                    rs.getLong("dungeon_map_id"),
                                    clusterId,
                                    hydratedRooms,
                                    flattenEdges(edgeObjectsByLevel))));
                }
            }
        }
        return List.copyOf(clusters);
    }

    private static Map<Long, Map<Integer, List<Point2i>>> loadClusterVerticesByLevel(Connection conn, long mapId) throws SQLException {
        Map<Long, Map<Integer, List<Point2i>>> result = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT cluster_id, level_z, relative_x, relative_y FROM dungeon_room_cluster_vertices"
                        + " WHERE cluster_id IN (SELECT cluster_id FROM dungeon_room_clusters WHERE dungeon_map_id=?)"
                        + " ORDER BY cluster_id, level_z, vertex_index")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.computeIfAbsent(rs.getLong("cluster_id"), ignored -> new LinkedHashMap<>())
                            .computeIfAbsent(rs.getInt("level_z"), ignored -> new ArrayList<>())
                            .add(new Point2i(rs.getInt("relative_x"), rs.getInt("relative_y")));
                }
            }
        }
        return copyNestedLists(result);
    }

    private static Map<Long, Map<Integer, List<EdgeObject>>> loadClusterEdgesByLevel(
            Connection conn,
            long mapId,
            Map<Long, Point2i> centersByClusterId
    ) throws SQLException {
        Map<Long, Map<Integer, List<EdgeObject>>> result = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT cluster_id, level_z, cell_x, cell_y, edge_direction, edge_type FROM dungeon_room_cluster_edges"
                        + " WHERE cluster_id IN (SELECT cluster_id FROM dungeon_room_clusters WHERE dungeon_map_id=?)"
                        + " ORDER BY cluster_id, level_z, cell_y, cell_x, edge_direction")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    result.computeIfAbsent(rs.getLong("cluster_id"), ignored -> new LinkedHashMap<>())
                            .computeIfAbsent(rs.getInt("level_z"), ignored -> new ArrayList<>())
                            .add(edgeObjectRelativeToCenter(
                                    new Point2i(rs.getInt("cell_x"), rs.getInt("cell_y")),
                                    centersByClusterId.get(rs.getLong("cluster_id")),
                                    rs.getString("edge_direction"),
                                    rs.getString("edge_type")));
                }
            }
        }
        return copyNestedLists(result);
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
            Map<Integer, TileShape> clusterShapesByLevel,
            Map<Integer, List<EdgeObject>> edgesByLevel,
            List<Room> rooms
    ) {
        // Persistence stores cluster topology in aggregate form; after loading, each room owns its runtime shape
        // and its touching boundary objects so later editor mutations can stay room-local by default.
        if (rooms == null || rooms.isEmpty()) {
            return List.of();
        }
        Map<Long, Map<Integer, Floor>> floorsByRoomId = initialFloorsByRoomId(rooms);
        Map<Long, List<Wall>> wallsByRoomId = new LinkedHashMap<>();
        for (Map.Entry<Integer, TileShape> levelEntry : clusterShapesByLevel.entrySet()) {
            int levelZ = levelEntry.getKey();
            Set<Point2i> clusterCells = levelEntry.getValue().absoluteCells();
            List<EdgeObject> edgeObjects = edgesByLevel.getOrDefault(levelZ, List.of());
            List<VertexPath> barriers = barriers(edgeObjects);
            Set<Point2i> unclaimedCells = new LinkedHashSet<>(clusterCells);
            for (Room room : rooms) {
                if (room == null || room.roomId() == null) {
                    continue;
                }
                Floor anchorFloor = room.floorAtLevel(levelZ);
                if (anchorFloor == null || anchorFloor.shape() == null) {
                    continue;
                }
                Point2i anchor = anchorFloor.shape().anchor();
                if (!clusterCells.contains(anchor)) {
                    throw new IllegalStateException(
                            "Raum " + room.roomId() + " hat einen Anker ausserhalb von Cluster " + clusterId + " auf Ebene " + levelZ);
                }
                if (!unclaimedCells.contains(anchor)) {
                    throw new IllegalStateException(
                            "Raum " + room.roomId() + " teilt sich einen offenen Bereich in Cluster " + clusterId + " auf Ebene " + levelZ);
                }
                Set<Point2i> roomCells = reachableCells(anchor, unclaimedCells, barriers);
                if (roomCells.isEmpty()) {
                    throw new IllegalStateException(
                            "Raum " + room.roomId() + " konnte in Cluster " + clusterId + " auf Ebene " + levelZ + " nicht hydriert werden");
                }
                unclaimedCells.removeAll(roomCells);
                floorsByRoomId.computeIfAbsent(room.roomId(), ignored -> new LinkedHashMap<>())
                        .put(levelZ, new Floor(TileShape.fromAbsoluteCells(roomCells)));
                wallsByRoomId.computeIfAbsent(room.roomId(), ignored -> new ArrayList<>())
                        .addAll(wallsForRoom(clusterCells, roomCells, edgeObjects));
            }
            if (!unclaimedCells.isEmpty()) {
                throw new IllegalStateException(
                        "Cluster " + clusterId + " enthaelt Zellen ohne Raumankerzuordnung auf Ebene " + levelZ);
            }
        }
        List<Room> hydratedRooms = new ArrayList<>();
        for (Room room : rooms) {
            if (room == null || room.roomId() == null) {
                continue;
            }
            hydratedRooms.add(Room.resolved(
                    room.roomId(),
                    room.mapId(),
                    room.clusterId(),
                    room.name(),
                    floorsByRoomId.getOrDefault(room.roomId(), room.floors()),
                    mergeWalls(wallsByRoomId.getOrDefault(room.roomId(), List.of())),
                    room.narration()));
        }
        return List.copyOf(hydratedRooms);
    }

    private static Map<Integer, TileShape> clusterShapesByLevel(Point2i center, Map<Integer, List<Point2i>> verticesByLevel) {
        Map<Integer, TileShape> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, List<Point2i>> entry : verticesByLevel.entrySet()) {
            result.put(entry.getKey(), tileShapeFromRelativeVertices(center, List.copyOf(entry.getValue())));
        }
        return Map.copyOf(result);
    }

    private static Map<Long, Map<Integer, Floor>> initialFloorsByRoomId(List<Room> rooms) {
        Map<Long, Map<Integer, Floor>> result = new LinkedHashMap<>();
        for (Room room : rooms) {
            if (room != null && room.roomId() != null) {
                result.put(room.roomId(), new LinkedHashMap<>(room.floors()));
            }
        }
        return result;
    }

    private static List<Wall> mergeWalls(List<Wall> walls) {
        Set<VertexEdge> mergedEdges = new LinkedHashSet<>();
        for (Wall wall : walls) {
            if (wall != null) {
                mergedEdges.addAll(wall.edges());
            }
        }
        return mergedEdges.isEmpty() ? List.of() : List.of(new Wall(mergedEdges));
    }

    private static List<EdgeObject> flattenEdges(Map<Integer, List<EdgeObject>> edgesByLevel) {
        List<EdgeObject> result = new ArrayList<>();
        for (List<EdgeObject> edges : edgesByLevel.values()) {
            result.addAll(edges);
        }
        return List.copyOf(result);
    }

    private static <K1, K2, V> Map<K1, Map<K2, V>> copyNestedMap(Map<K1, Map<K2, V>> source) {
        Map<K1, Map<K2, V>> result = new LinkedHashMap<>();
        for (Map.Entry<K1, Map<K2, V>> entry : source.entrySet()) {
            result.put(entry.getKey(), Map.copyOf(entry.getValue()));
        }
        return Map.copyOf(result);
    }

    private static <K1, K2, V> Map<K1, Map<K2, List<V>>> copyNestedLists(Map<K1, Map<K2, List<V>>> source) {
        Map<K1, Map<K2, List<V>>> result = new LinkedHashMap<>();
        for (Map.Entry<K1, Map<K2, List<V>>> outerEntry : source.entrySet()) {
            Map<K2, List<V>> nested = new LinkedHashMap<>();
            for (Map.Entry<K2, List<V>> innerEntry : outerEntry.getValue().entrySet()) {
                nested.put(innerEntry.getKey(), List.copyOf(innerEntry.getValue()));
            }
            result.put(outerEntry.getKey(), Map.copyOf(nested));
        }
        return Map.copyOf(result);
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

    private static final class LoadedCatalog {
        private final List<DungeonMapCatalogEntry> allMaps;
        private final List<DungeonMapCatalogEntry> usableMaps;
        private final Map<Long, DungeonLayout> layoutsById;
        private final Map<DungeonMapCatalogEntry, String> failuresByMap;

        private LoadedCatalog(
                List<DungeonMapCatalogEntry> allMaps,
                List<DungeonMapCatalogEntry> usableMaps,
                Map<Long, DungeonLayout> layoutsById,
                Map<DungeonMapCatalogEntry, String> failuresByMap
        ) {
            this.allMaps = allMaps == null ? List.of() : List.copyOf(allMaps);
            this.usableMaps = usableMaps == null ? List.of() : List.copyOf(usableMaps);
            this.layoutsById = layoutsById == null ? Map.of() : Map.copyOf(layoutsById);
            this.failuresByMap = failuresByMap == null ? Map.of() : Map.copyOf(failuresByMap);
        }

        private List<DungeonMapCatalogEntry> allMaps() {
            return allMaps;
        }

        private List<DungeonMapCatalogEntry> usableMaps() {
            return usableMaps;
        }

        private Map<Long, DungeonLayout> layoutsById() {
            return layoutsById;
        }

        private String failureMessage() {
            if (failuresByMap.isEmpty()) {
                return null;
            }
            List<Map.Entry<DungeonMapCatalogEntry, String>> failures = failuresByMap.entrySet().stream()
                    .sorted(Comparator.comparingLong(entry -> entry.getKey().mapId()))
                    .toList();
            Map.Entry<DungeonMapCatalogEntry, String> firstFailure = failures.getFirst();
            String prefix = failures.size() == 1
                    ? "1 Dungeon konnte nicht geladen werden"
                    : failures.size() + " Dungeons konnten nicht geladen werden";
            return prefix + ": " + firstFailure.getKey().name() + " (" + firstFailure.getValue() + ")";
        }
    }
}
