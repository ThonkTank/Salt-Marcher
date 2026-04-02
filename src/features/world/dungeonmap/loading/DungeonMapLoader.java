package features.world.dungeonmap.loading;

import database.DatabaseManager;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.objects.Door;
import features.world.dungeonmap.model.objects.StructureDescriptor;
import features.world.dungeonmap.model.objects.StructureObject;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.LocalConnection;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorNode;
import features.world.dungeonmap.model.structures.corridor.CorridorSegment;
import features.world.dungeonmap.model.structures.room.RoomExitNarration;
import features.world.dungeonmap.model.structures.room.RoomNarration;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.persistence.DungeonPersistenceDirections;
import features.world.dungeonmap.persistence.DungeonSchemaSupport;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;
import features.world.dungeonmap.model.structures.transition.DungeonTransitionDestination;
import features.world.dungeonmap.persistence.DungeonTransitionSchemaSupport;

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
import java.util.Set;

/**
 * The loader must reconstruct the active dungeon only from direct structure owners.
 *
 * <p>If loaded behavior depends on a hidden fallback or reconstruction layer, it belongs back on the owning model
 * instead of in this loader.
 */
public final class DungeonMapLoader {

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
        List<Corridor> corridors = loadCorridors(conn, map.mapId(), roomsById(clusters));
        List<DungeonStair> stairs = loadStairs(conn, map.mapId(), clusters, corridors);
        return new DungeonLayout(
                map.mapId(),
                map.name(),
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
        Map<Long, StructureDescriptor> descriptorsByRoomId = loadRoomDescriptors(conn, mapId);
        Map<Long, List<RoomExitNarration>> exitNarrationsByRoomId = loadGrouped(conn,
                "SELECT room_id, level_z, cell_x, cell_y, edge_direction, description"
                        + " FROM dungeon_room_exit_descriptions"
                        + " WHERE room_id IN (SELECT room_id FROM dungeon_rooms WHERE dungeon_map_id=?)"
                        + " ORDER BY room_id, level_z, sort_order, cell_y, cell_x, edge_direction",
                mapId,
                rs -> rs.getLong("room_id"),
                rs -> new RoomExitNarration(
                        rs.getInt("level_z"),
                        new CellCoord(rs.getInt("cell_x"), rs.getInt("cell_y")),
                        DungeonPersistenceDirections.fromPersistedEdgeDirection(rs.getString("edge_direction")),
                        rs.getString("description")));
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT room_id, dungeon_map_id, cluster_id, name, visual_description"
                        + " FROM dungeon_rooms WHERE dungeon_map_id=? ORDER BY room_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                List<Room> rooms = new ArrayList<>();
                while (rs.next()) {
                    long roomId = rs.getLong("room_id");
                    StructureDescriptor descriptor = descriptorsByRoomId.get(roomId);
                    if (descriptor == null || descriptor.levels().isEmpty()) {
                        throw new IllegalStateException("Raum " + roomId + " hat keine persistierte Strukturbeschreibung");
                    }
                    StructureObject structure = StructureObject.fromDescriptor(descriptor);
                    if (structure.cellCoords().isEmpty()) {
                        throw new IllegalStateException("Raum " + roomId + " hydriert ohne begehbare Struktur");
                    }
                    rooms.add(Room.resolved(
                            roomId,
                            rs.getLong("dungeon_map_id"),
                            rs.getLong("cluster_id"),
                            normalizedRoomName(roomId, rs.getString("name")),
                            structure,
                            new RoomNarration(
                                    rs.getString("visual_description"),
                                    exitNarrationsByRoomId.getOrDefault(roomId, List.of()))));
                }
                return List.copyOf(rooms);
            }
        }
    }

    private static List<DungeonStair> loadStairs(
            Connection conn,
            long mapId,
            List<RoomCluster> clusters,
            List<Corridor> corridors
    ) throws SQLException {
        DungeonSchemaSupport.ensureCompatibility(conn);
        // Stair exits are intentionally re-derived on every load from explicit path geometry plus
        // current floor occupancy. There is no legacy/materialized exit source of truth anymore.
        Map<Long, List<CubePoint>> pathByStairId = loadGrouped(conn,
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

    private static Set<CubePoint> occupiedFloorPoints(
            List<RoomCluster> clusters,
            List<Corridor> corridors
    ) {
        // This is the full floor occupancy that may materialize read-only stair exits.
        LinkedHashSet<CubePoint> result = new LinkedHashSet<>();
        for (RoomCluster cluster : clusters == null ? List.<RoomCluster>of() : clusters) {
            if (cluster == null) {
                continue;
            }
            for (Room room : cluster.rooms()) {
                if (room != null) {
                    result.addAll(room.structure().cubePoints());
                }
            }
        }
        for (Corridor corridor : corridors == null ? List.<Corridor>of() : corridors) {
            if (corridor != null) {
                result.addAll(corridor.structure().cubePoints());
            }
        }
        return Set.copyOf(result);
    }

    private static List<Corridor> loadCorridors(
            Connection conn,
            long mapId,
            Map<Long, Room> roomsById
    ) throws SQLException {
        // Load direct corridor graph truth only; persisted x2 coordinates are the same canonical raw values used in memory.
        DungeonSchemaSupport.ensureCompatibility(conn);
        Map<Long, List<CorridorNode>> nodesByCorridorId = loadGrouped(conn,
                "SELECT corridor_id, corridor_node_id, grid_x2, grid_y2, room_id, room_relative_cell_x, room_relative_cell_y, room_edge_direction"
                        + " FROM dungeon_corridor_nodes"
                        + " WHERE corridor_id IN (SELECT corridor_id FROM dungeon_corridors WHERE dungeon_map_id=?)"
                        + " ORDER BY corridor_id, corridor_node_id",
                mapId,
                row -> row.getLong("corridor_id"),
                row -> new CorridorNode(
                        row.getLong("corridor_node_id"),
                        GridPoint2x.raw(row.getInt("grid_x2"), row.getInt("grid_y2")),
                        nullableLong(row, "room_id"),
                        row.getObject("room_relative_cell_x") == null
                                ? null
                                : new CellCoord(row.getInt("room_relative_cell_x"), row.getInt("room_relative_cell_y")),
                        row.getString("room_edge_direction") == null
                                ? null
                                : CardinalDirection.valueOf(row.getString("room_edge_direction").trim().toUpperCase(java.util.Locale.ROOT))));
        Map<Long, List<CorridorSegment>> segmentsByCorridorId = loadGrouped(conn,
                "SELECT corridor_id, corridor_segment_id, start_node_id, end_node_id"
                        + " FROM dungeon_corridor_segments"
                        + " WHERE corridor_id IN (SELECT corridor_id FROM dungeon_corridors WHERE dungeon_map_id=?)"
                        + " ORDER BY corridor_id, corridor_segment_id",
                mapId,
                row -> row.getLong("corridor_id"),
                row -> new CorridorSegment(
                        row.getLong("corridor_segment_id"),
                        row.getLong("start_node_id"),
                        row.getLong("end_node_id")));
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT corridor_id, dungeon_map_id, level_z"
                        + " FROM dungeon_corridors WHERE dungeon_map_id=? ORDER BY corridor_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                List<Corridor> result = new ArrayList<>();
                while (rs.next()) {
                    long corridorId = rs.getLong("corridor_id");
                    result.add(Corridor.resolved(
                            corridorId,
                            rs.getLong("dungeon_map_id"),
                            rs.getInt("level_z"),
                            nodesByCorridorId.getOrDefault(corridorId, List.of()),
                            segmentsByCorridorId.getOrDefault(corridorId, List.of()),
                            roomsById));
                }
                return result.isEmpty() ? List.of() : List.copyOf(result);
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

    private static Map<Long, StructureDescriptor> loadRoomDescriptors(Connection conn, long mapId) throws SQLException {
        Map<Long, Map<Integer, CellCoord>> anchorsByRoomId = new LinkedHashMap<>();
        Map<Long, Map<Integer, Set<CellCoord>>> seedsByRoomId = new LinkedHashMap<>();
        Map<Long, Map<Integer, Set<GridSegment2x>>> boundarySegmentsByRoomId = new LinkedHashMap<>();
        Map<Long, Map<Integer, Set<GridSegment2x>>> openingSegmentsByRoomId = new LinkedHashMap<>();
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT room_id, level_z, anchor_x2, anchor_y2"
                        + " FROM dungeon_room_levels"
                        + " WHERE room_id IN (SELECT room_id FROM dungeon_rooms WHERE dungeon_map_id=?)"
                        + " ORDER BY room_id, level_z")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    anchorsByRoomId.computeIfAbsent(rs.getLong("room_id"), ignored -> new LinkedHashMap<>())
                            .put(rs.getInt("level_z"), requireStoredCellCenter(
                                    rs.getInt("anchor_x2"),
                                    rs.getInt("anchor_y2"),
                                    "room anchor",
                                    rs.getLong("room_id"),
                                    rs.getInt("level_z")));
                }
            }
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT room_id, level_z, seed_x2, seed_y2"
                        + " FROM dungeon_room_level_seeds"
                        + " WHERE room_id IN (SELECT room_id FROM dungeon_rooms WHERE dungeon_map_id=?)"
                        + " ORDER BY room_id, level_z, seed_y2, seed_x2")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    seedsByRoomId.computeIfAbsent(rs.getLong("room_id"), ignored -> new LinkedHashMap<>())
                            .computeIfAbsent(rs.getInt("level_z"), ignored -> new LinkedHashSet<>())
                            .add(requireStoredCellCenter(
                                    rs.getInt("seed_x2"),
                                    rs.getInt("seed_y2"),
                                    "room fill seed",
                                    rs.getLong("room_id"),
                                    rs.getInt("level_z")));
                }
            }
        }
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT room_id, level_z, segment_kind, start_x2, start_y2, end_x2, end_y2"
                        + " FROM dungeon_room_level_segments"
                        + " WHERE room_id IN (SELECT room_id FROM dungeon_rooms WHERE dungeon_map_id=?)"
                        + " ORDER BY room_id, level_z, segment_kind, start_y2, start_x2, end_y2, end_x2")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long roomId = rs.getLong("room_id");
                    int levelZ = rs.getInt("level_z");
                    Map<Long, Map<Integer, Set<GridSegment2x>>> target = "OPENING".equals(rs.getString("segment_kind"))
                            ? openingSegmentsByRoomId
                            : boundarySegmentsByRoomId;
                    target.computeIfAbsent(roomId, ignored -> new LinkedHashMap<>())
                            .computeIfAbsent(levelZ, ignored -> new LinkedHashSet<>())
                            .addAll(storedBoundarySteps(
                                    rs.getInt("start_x2"),
                                    rs.getInt("start_y2"),
                                    rs.getInt("end_x2"),
                                    rs.getInt("end_y2")));
                }
            }
        }
        Map<Long, StructureDescriptor> result = new LinkedHashMap<>();
        for (Map.Entry<Long, Map<Integer, CellCoord>> roomEntry : anchorsByRoomId.entrySet()) {
            Long roomId = roomEntry.getKey();
            Map<Integer, StructureDescriptor.LevelDescriptor> levels = new LinkedHashMap<>();
            for (Map.Entry<Integer, CellCoord> levelEntry : roomEntry.getValue().entrySet()) {
                int levelZ = levelEntry.getKey();
                levels.put(levelZ, new StructureDescriptor.LevelDescriptor(
                        levelEntry.getValue(),
                        seedsByRoomId.getOrDefault(roomId, Map.of()).getOrDefault(levelZ, Set.of()),
                        boundarySegmentsByRoomId.getOrDefault(roomId, Map.of()).getOrDefault(levelZ, Set.of()),
                        openingSegmentsByRoomId.getOrDefault(roomId, Map.of()).getOrDefault(levelZ, Set.of())));
            }
            result.put(roomId, new StructureDescriptor(levels));
        }
        return Map.copyOf(result);
    }

    private static CellCoord requireStoredCellCenter(int persistedX2, int persistedY2, String label, long roomId, int levelZ) {
        return GridPoint2x.raw(persistedX2, persistedY2).asCell().orElseThrow(() -> new IllegalArgumentException(
                label + " must be a tile center for room " + roomId + " at level " + levelZ));
    }

    private static Set<GridSegment2x> storedBoundarySteps(int startX2, int startY2, int endX2, int endY2) {
        return GridSegment2x.boundarySteps(Set.of(new GridSegment2x(
                GridPoint2x.raw(startX2, startY2),
                GridPoint2x.raw(endX2, endY2))));
    }

    private static List<RoomCluster> loadClusters(Connection conn, long mapId, List<Room> rooms) throws SQLException {
        List<RoomCluster> clusters = new ArrayList<>();
        Map<Long, List<Room>> roomsByClusterId = roomsByClusterId(rooms);
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT cluster_id, dungeon_map_id, center_x, center_y FROM dungeon_room_clusters"
                        + " WHERE dungeon_map_id=? ORDER BY cluster_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long clusterId = rs.getLong("cluster_id");
                    List<Room> clusterRooms = roomsByClusterId.getOrDefault(clusterId, List.of());
                    clusters.add(new RoomCluster(
                            clusterId,
                            rs.getLong("dungeon_map_id"),
                            new CellCoord(rs.getInt("center_x"), rs.getInt("center_y")),
                            clusterRooms,
                            materializeLocalConnections(rs.getLong("dungeon_map_id"), clusterId, clusterRooms)));
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

    private static Map<Long, Room> roomsById(List<RoomCluster> clusters) {
        Map<Long, Room> result = new LinkedHashMap<>();
        for (RoomCluster cluster : clusters) {
            if (cluster == null) {
                continue;
            }
            for (Room room : cluster.rooms()) {
                if (room != null && room.roomId() != null) {
                    result.put(room.roomId(), room);
                }
            }
        }
        return Map.copyOf(result);
    }

    private static List<LocalConnection> materializeLocalConnections(
            long mapId,
            long clusterId,
            List<Room> rooms
    ) {
        Map<CubePoint, Room> roomsByPoint = new LinkedHashMap<>();
        Map<String, DoorComponent> doorsByKey = new LinkedHashMap<>();
        for (Room room : rooms) {
            if (room == null) {
                continue;
            }
            for (CubePoint point : room.structure().cubePoints()) {
                roomsByPoint.putIfAbsent(point, room);
            }
            for (Integer levelZ : room.structure().levels()) {
                for (Door door : room.structure().doorsAtLevel(levelZ)) {
                    doorsByKey.putIfAbsent(doorKey(levelZ, door), new DoorComponent(levelZ, door));
                }
            }
        }
        List<LocalConnection> result = new ArrayList<>();
        for (DoorComponent doorComponent : doorsByKey.values()) {
            LocalConnection connection = materializeLocalConnection(mapId, clusterId, doorComponent, roomsByPoint);
            if (connection != null) {
                result.add(connection);
            }
        }
        return List.copyOf(result);
    }

    private static LocalConnection materializeLocalConnection(
            long mapId,
            long clusterId,
            DoorComponent doorComponent,
            Map<CubePoint, Room> roomsByPoint
    ) {
        if (doorComponent == null || doorComponent.door() == null) {
            return null;
        }
        List<Room> touchingRooms = new ArrayList<>();
        for (GridSegment2x segment2x : doorComponent.door().segments2x()) {
            for (CellCoord cell : segment2x.touchingCells().stream().sorted(CellCoord.ORDER).toList()) {
                Room room = roomsByPoint.get(CubePoint.at(cell, doorComponent.levelZ()));
                if (room != null && !touchingRooms.contains(room)) {
                    touchingRooms.add(room);
                }
            }
        }
        List<ConnectionEndpoint> endpoints = endpointsForDoor(clusterId, touchingRooms);
        if (endpoints.size() != 2) {
            return null;
        }
        return new LocalConnection(
                null,
                mapId,
                clusterId,
                doorComponent.levelZ(),
                Door.fromSegments(doorComponent.door().segments2x(), doorComponent.door().doorState()),
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

    private static String doorKey(int levelZ, Door door) {
        if (door == null) {
            return levelZ + ":";
        }
        StringBuilder builder = new StringBuilder();
        builder.append(levelZ).append(':');
        boolean first = true;
        for (GridSegment2x segment2x : door.segments2x().stream().sorted(GridSegment2x.ORDER).toList()) {
            if (!first) {
                builder.append('|');
            }
            first = false;
            builder.append(segment2x.start().x2()).append(',').append(segment2x.start().y2())
                    .append('-')
                    .append(segment2x.end().x2()).append(',').append(segment2x.end().y2());
        }
        return builder.toString();
    }

    @FunctionalInterface
    private interface ResultSetMapper<T> {
        T map(ResultSet rs) throws SQLException;
    }

    private static String normalizedRoomName(long roomId, String name) {
        return name == null || name.isBlank() ? "Raum " + roomId : name.trim();
    }

    private static Long nullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }

    private record DoorComponent(int levelZ, Door door) {
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
