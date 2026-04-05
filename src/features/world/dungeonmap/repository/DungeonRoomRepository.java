package features.world.dungeonmap.repository;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.objects.StructureDescriptor;
import features.world.dungeonmap.model.objects.StructureObject;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.room.RoomExitNarration;
import features.world.dungeonmap.model.structures.room.RoomNarration;
import features.world.dungeonmap.model.structures.room.Room;

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
import java.util.Set;

public final class DungeonRoomRepository {

    public List<Room> loadRooms(Connection conn, long mapId) throws SQLException {
        Map<Long, StructureDescriptor> descriptorsByRoomId = loadRoomDescriptors(conn, mapId);
        Map<Long, List<RoomExitNarration>> exitNarrationsByRoomId = loadGrouped(
                conn,
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
                return rooms.isEmpty() ? List.of() : List.copyOf(rooms);
            }
        }
    }

    public List<RoomCluster> loadClusters(Connection conn, long mapId, List<Room> rooms) throws SQLException {
        List<RoomCluster> clusters = new ArrayList<>();
        Map<Long, List<Room>> roomsByClusterId = roomsByClusterId(rooms);
        try (PreparedStatement ps = conn.prepareStatement(
                "SELECT cluster_id, dungeon_map_id, center_x, center_y FROM dungeon_room_clusters"
                        + " WHERE dungeon_map_id=? ORDER BY cluster_id")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    long clusterId = rs.getLong("cluster_id");
                    clusters.add(new RoomCluster(
                            clusterId,
                            rs.getLong("dungeon_map_id"),
                            new CellCoord(rs.getInt("center_x"), rs.getInt("center_y")),
                            roomsByClusterId.getOrDefault(clusterId, List.of())));
                }
            }
        }
        return clusters.isEmpty() ? List.of() : List.copyOf(clusters);
    }

    public Map<Long, Integer> loadClusterLevels(Connection conn, long mapId) throws SQLException {
        return loadLevelMap(conn,
                "SELECT cluster_id AS entity_id, level_z FROM dungeon_room_clusters WHERE dungeon_map_id=?",
                mapId);
    }

    public void createClusterWithRoom(
            Connection conn,
            long mapId,
            int levelZ,
            Set<CellCoord> cells,
            String roomName
    ) throws SQLException {
        Set<CellCoord> resolvedCells = cells == null ? Set.of() : Set.copyOf(cells);
        if (resolvedCells.isEmpty()) {
            return;
        }
        long clusterId = insertCluster(conn, mapId, CellCoord.bestCenter(resolvedCells), levelZ);
        insertRoom(
                conn,
                mapId,
                clusterId,
                roomName,
                StructureDescriptor.fromCellCoordsByLevel(Map.of(levelZ, resolvedCells)));
    }

    /**
     * Realizes the room workflow's final cluster owners directly instead of replaying a second rewrite payload.
     */
    public void replaceClusters(
            Connection conn,
            long mapId,
            List<RoomCluster> originalClusters,
            List<RoomCluster> finalClusters
    ) throws SQLException {
        List<RoomCluster> resolvedOriginalClusters = normalizedClusters(originalClusters);
        List<RoomCluster> resolvedFinalClusters = normalizedClusters(finalClusters);
        if (resolvedOriginalClusters.isEmpty() && resolvedFinalClusters.isEmpty()) {
            return;
        }

        Set<Long> finalRoomIds = roomIds(resolvedFinalClusters);
        for (Long roomId : roomIds(resolvedOriginalClusters)) {
            if (roomId != null && !finalRoomIds.contains(roomId)) {
                deleteRoom(conn, roomId);
            }
        }

        Set<Long> retainedClusterIds = new LinkedHashSet<>();
        for (RoomCluster cluster : resolvedFinalClusters) {
            if (cluster == null || cluster.clusterId() == null) {
                continue;
            }
            retainedClusterIds.add(cluster.clusterId());
            updateClusterMetadata(conn, cluster.clusterId(), cluster.center(), cluster.primaryLevel());
            persistRooms(conn, mapId, cluster.clusterId(), cluster.rooms());
        }

        for (RoomCluster cluster : resolvedFinalClusters) {
            if (cluster == null || cluster.clusterId() != null) {
                continue;
            }
            long clusterId = insertCluster(conn, mapId, cluster.center(), cluster.primaryLevel());
            persistRooms(conn, mapId, clusterId, cluster.rooms());
        }

        for (RoomCluster cluster : resolvedOriginalClusters) {
            if (cluster == null || cluster.clusterId() == null || retainedClusterIds.contains(cluster.clusterId())) {
                continue;
            }
            deleteCluster(conn, cluster.clusterId());
        }
    }

    public void saveMovedCluster(Connection conn, RoomCluster cluster) throws SQLException {
        if (cluster == null || cluster.clusterId() == null) {
            return;
        }
        updateClusterMetadata(conn, cluster.clusterId(), cluster.center(), cluster.primaryLevel());
        persistRooms(conn, cluster.mapId(), cluster.clusterId(), cluster.rooms());
    }

    public void saveRooms(Connection conn, long mapId, List<Room> rooms) throws SQLException {
        if (conn == null || rooms == null || rooms.isEmpty()) {
            return;
        }
        for (Room room : rooms) {
            if (room == null || room.roomId() == null) {
                continue;
            }
            reassignRoomCluster(conn, room.roomId(), room.clusterId());
            updateRoom(conn, room.roomId(), room.name(), room.structure().descriptor());
        }
    }

    private long insertCluster(Connection conn, long mapId, CellCoord center, int levelZ) throws SQLException {
        CellCoord resolvedCenter = center == null ? new CellCoord(0, 0) : center;
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_room_clusters(dungeon_map_id, center_x, center_y, level_z) VALUES(?,?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, mapId);
            ps.setInt(2, resolvedCenter.x());
            ps.setInt(3, resolvedCenter.y());
            ps.setInt(4, levelZ);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (!rs.next()) {
                    throw new SQLException("No key returned for dungeon_room_clusters insert");
                }
                return rs.getLong(1);
            }
        }
    }

    private void updateClusterMetadata(Connection conn, long clusterId, CellCoord center, int levelZ) throws SQLException {
        CellCoord resolvedCenter = center == null ? new CellCoord(0, 0) : center;
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_room_clusters SET center_x=?, center_y=?, level_z=? WHERE cluster_id=?")) {
            ps.setInt(1, resolvedCenter.x());
            ps.setInt(2, resolvedCenter.y());
            ps.setInt(3, levelZ);
            ps.setLong(4, clusterId);
            ps.executeUpdate();
        }
    }

    private void deleteCluster(Connection conn, long clusterId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_room_clusters WHERE cluster_id=?")) {
            ps.setLong(1, clusterId);
            ps.executeUpdate();
        }
    }

    private long insertRoom(
            Connection conn,
            long mapId,
            long clusterId,
            String name,
            StructureDescriptor descriptor
    ) throws SQLException {
        StructureDescriptor resolvedDescriptor = requiredDescriptor(descriptor);
        int primaryLevel = primaryLevel(resolvedDescriptor);
        CellCoord primaryAnchor = primaryAnchorCell(resolvedDescriptor);
        try (PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO dungeon_rooms(dungeon_map_id, cluster_id, name, component_x, component_y, level_z) VALUES(?,?,?,?,?,?)",
                Statement.RETURN_GENERATED_KEYS)) {
            ps.setLong(1, mapId);
            ps.setLong(2, clusterId);
            ps.setString(3, name);
            ps.setInt(4, primaryAnchor.x());
            ps.setInt(5, primaryAnchor.y());
            ps.setInt(6, primaryLevel);
            ps.executeUpdate();
            try (ResultSet rs = ps.getGeneratedKeys()) {
                if (!rs.next()) {
                    throw new SQLException("No key returned for dungeon_rooms insert");
                }
                long roomId = rs.getLong(1);
                replaceRoomDescriptor(conn, roomId, resolvedDescriptor);
                return roomId;
            }
        }
    }

    private void updateRoom(
            Connection conn,
            long roomId,
            String name,
            StructureDescriptor descriptor
    ) throws SQLException {
        StructureDescriptor resolvedDescriptor = requiredDescriptor(descriptor);
        int primaryLevel = primaryLevel(resolvedDescriptor);
        CellCoord primaryAnchor = primaryAnchorCell(resolvedDescriptor);
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_rooms SET name=?, component_x=?, component_y=?, level_z=? WHERE room_id=?")) {
            ps.setString(1, name);
            ps.setInt(2, primaryAnchor.x());
            ps.setInt(3, primaryAnchor.y());
            ps.setInt(4, primaryLevel);
            ps.setLong(5, roomId);
            ps.executeUpdate();
        }
        replaceRoomDescriptor(conn, roomId, resolvedDescriptor);
    }

    public void replaceRoomNarration(Connection conn, long roomId, RoomNarration narration) throws SQLException {
        RoomNarration resolvedNarration = narration == null ? RoomNarration.empty() : narration;
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_rooms SET visual_description=? WHERE room_id=?")) {
            ps.setString(1, resolvedNarration.visualDescription());
            ps.setLong(2, roomId);
            ps.executeUpdate();
        }
        try (PreparedStatement delete = conn.prepareStatement(
                "DELETE FROM dungeon_room_exit_descriptions WHERE room_id=?")) {
            delete.setLong(1, roomId);
            delete.executeUpdate();
        }
        try (PreparedStatement insert = conn.prepareStatement(
                "INSERT INTO dungeon_room_exit_descriptions(room_id, level_z, cell_x, cell_y, edge_direction, description, sort_order)"
                        + " VALUES(?,?,?,?,?,?,?)")) {
            int sortOrder = 0;
            for (RoomExitNarration exitNarration : resolvedNarration.exitNarrations()) {
                insert.setLong(1, roomId);
                insert.setInt(2, exitNarration.levelZ());
                insert.setInt(3, exitNarration.roomCell().x());
                insert.setInt(4, exitNarration.roomCell().y());
                insert.setString(5, DungeonPersistenceDirections.toPersistedEdgeDirection(exitNarration.direction()));
                insert.setString(6, exitNarration.description());
                insert.setInt(7, sortOrder++);
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private void reassignRoomCluster(Connection conn, long roomId, long clusterId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "UPDATE dungeon_rooms SET cluster_id=? WHERE room_id=?")) {
            ps.setLong(1, clusterId);
            ps.setLong(2, roomId);
            ps.executeUpdate();
        }
    }

    private void deleteRoom(Connection conn, long roomId) throws SQLException {
        try (PreparedStatement ps = conn.prepareStatement(
                "DELETE FROM dungeon_rooms WHERE room_id=?")) {
            ps.setLong(1, roomId);
            ps.executeUpdate();
        }
    }

    private void replaceRoomDescriptor(Connection conn, long roomId, StructureDescriptor descriptor) throws SQLException {
        StructureDescriptor resolvedDescriptor = requiredDescriptor(descriptor);
        try (PreparedStatement deleteSegments = conn.prepareStatement(
                "DELETE FROM dungeon_room_level_segments WHERE room_id=?");
             PreparedStatement deleteFloorCells = conn.prepareStatement(
                     "DELETE FROM dungeon_room_level_floor_cells WHERE room_id=?");
             PreparedStatement deleteSeeds = conn.prepareStatement(
                     "DELETE FROM dungeon_room_level_seeds WHERE room_id=?");
             PreparedStatement deleteLevels = conn.prepareStatement(
                     "DELETE FROM dungeon_room_levels WHERE room_id=?")) {
            deleteSegments.setLong(1, roomId);
            deleteSegments.executeUpdate();
            deleteFloorCells.setLong(1, roomId);
            deleteFloorCells.executeUpdate();
            deleteSeeds.setLong(1, roomId);
            deleteSeeds.executeUpdate();
            deleteLevels.setLong(1, roomId);
            deleteLevels.executeUpdate();
        }
        try (PreparedStatement insertLevel = conn.prepareStatement(
                "INSERT INTO dungeon_room_levels(room_id, level_z, anchor_x2, anchor_y2) VALUES(?,?,?,?)");
             PreparedStatement insertFloorCell = conn.prepareStatement(
                     "INSERT INTO dungeon_room_level_floor_cells(room_id, level_z, cell_x2, cell_y2) VALUES(?,?,?,?)");
             PreparedStatement insertSeed = conn.prepareStatement(
                     "INSERT INTO dungeon_room_level_seeds(room_id, level_z, seed_x2, seed_y2) VALUES(?,?,?,?)");
            PreparedStatement insertSegment = conn.prepareStatement(
                     "INSERT INTO dungeon_room_level_segments("
                             + "room_id, level_z, segment_kind, start_x2, start_y2, end_x2, end_y2"
                             + ") VALUES(?,?,?,?,?,?,?)")) {
            for (var entry : resolvedDescriptor.levels().entrySet()) {
                int levelZ = entry.getKey();
                StructureDescriptor.LevelDescriptor level = entry.getValue();
                insertLevel.setLong(1, roomId);
                insertLevel.setInt(2, levelZ);
                insertLevel.setInt(3, persistedCellX2(level.anchorCell()));
                insertLevel.setInt(4, persistedCellY2(level.anchorCell()));
                insertLevel.addBatch();
                for (CellCoord floorCell : level.floorCells().stream()
                        .sorted(CellCoord.ORDER)
                        .toList()) {
                    insertFloorCell.setLong(1, roomId);
                    insertFloorCell.setInt(2, levelZ);
                    insertFloorCell.setInt(3, persistedCellX2(floorCell));
                    insertFloorCell.setInt(4, persistedCellY2(floorCell));
                    insertFloorCell.addBatch();
                }
                for (CellCoord seed : level.fillSeeds().stream()
                        .sorted(CellCoord.ORDER)
                        .toList()) {
                    insertSeed.setLong(1, roomId);
                    insertSeed.setInt(2, levelZ);
                    insertSeed.setInt(3, persistedCellX2(seed));
                    insertSeed.setInt(4, persistedCellY2(seed));
                    insertSeed.addBatch();
                }
                addSegments(insertSegment, roomId, levelZ, "BOUNDARY", level.boundaryEdges());
                addSegments(insertSegment, roomId, levelZ, "OPENING", level.openingEdges());
            }
            insertLevel.executeBatch();
            insertFloorCell.executeBatch();
            insertSeed.executeBatch();
            insertSegment.executeBatch();
        }
    }

    private static void addSegments(
            PreparedStatement insertSegment,
            long roomId,
            int levelZ,
            String kind,
            java.util.Collection<GridSegment2x> segments
    ) throws SQLException {
        for (GridSegment2x persistedSegment : GridSegment2x.boundarySteps(segments).stream()
                .sorted(GridSegment2x.ORDER)
                .toList()) {
            insertSegment.setLong(1, roomId);
            insertSegment.setInt(2, levelZ);
            insertSegment.setString(3, kind);
            insertSegment.setInt(4, persistedSegment.start().x2());
            insertSegment.setInt(5, persistedSegment.start().y2());
            insertSegment.setInt(6, persistedSegment.end().x2());
            insertSegment.setInt(7, persistedSegment.end().y2());
            insertSegment.addBatch();
        }
    }

    private void persistRooms(Connection conn, long mapId, long clusterId, List<Room> rooms) throws SQLException {
        for (Room room : rooms == null ? List.<Room>of() : rooms) {
            if (room == null) {
                continue;
            }
            if (room.roomId() == null) {
                insertRoom(
                        conn,
                        mapId,
                        clusterId,
                        room.name(),
                        room.structure().descriptor());
                continue;
            }
            reassignRoomCluster(conn, room.roomId(), clusterId);
            updateRoom(conn, room.roomId(), room.name(), room.structure().descriptor());
        }
    }

    private static StructureDescriptor requiredDescriptor(StructureDescriptor descriptor) {
        StructureDescriptor resolvedDescriptor = descriptor == null ? StructureDescriptor.empty() : descriptor;
        if (resolvedDescriptor.levels().isEmpty()) {
            throw new IllegalArgumentException("Room descriptor must not be empty");
        }
        return resolvedDescriptor;
    }

    private static int primaryLevel(StructureDescriptor descriptor) {
        return descriptor.levels().keySet().stream()
                .mapToInt(Integer::intValue)
                .min()
                .orElse(0);
    }

    private static CellCoord primaryAnchorCell(StructureDescriptor descriptor) {
        StructureDescriptor.LevelDescriptor level = descriptor.level(primaryLevel(descriptor));
        if (level == null) {
            return new CellCoord(0, 0);
        }
        return level.anchorCell();
    }

    private static int persistedCellX2(CellCoord cell) {
        CellCoord resolvedCell = cell == null ? new CellCoord(0, 0) : cell;
        return GridPoint2x.cell(resolvedCell).x2();
    }

    private static int persistedCellY2(CellCoord cell) {
        CellCoord resolvedCell = cell == null ? new CellCoord(0, 0) : cell;
        return GridPoint2x.cell(resolvedCell).y2();
    }

    private static Map<Long, StructureDescriptor> loadRoomDescriptors(Connection conn, long mapId) throws SQLException {
        Map<Long, Map<Integer, CellCoord>> anchorsByRoomId = new LinkedHashMap<>();
        Map<Long, Map<Integer, Set<CellCoord>>> floorCellsByRoomId = new LinkedHashMap<>();
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
                "SELECT room_id, level_z, cell_x2, cell_y2"
                        + " FROM dungeon_room_level_floor_cells"
                        + " WHERE room_id IN (SELECT room_id FROM dungeon_rooms WHERE dungeon_map_id=?)"
                        + " ORDER BY room_id, level_z, cell_y2, cell_x2")) {
            ps.setLong(1, mapId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    floorCellsByRoomId.computeIfAbsent(rs.getLong("room_id"), ignored -> new LinkedHashMap<>())
                            .computeIfAbsent(rs.getInt("level_z"), ignored -> new LinkedHashSet<>())
                            .add(requireStoredCellCenter(
                                    rs.getInt("cell_x2"),
                                    rs.getInt("cell_y2"),
                                    "room floor cell",
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
                    // Room segments are already persisted as stepwise boundary edges.
                    target.computeIfAbsent(roomId, ignored -> new LinkedHashMap<>())
                            .computeIfAbsent(levelZ, ignored -> new LinkedHashSet<>())
                            .add(new GridSegment2x(
                                    GridPoint2x.raw(rs.getInt("start_x2"), rs.getInt("start_y2")),
                                    GridPoint2x.raw(rs.getInt("end_x2"), rs.getInt("end_y2"))));
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
                        openingSegmentsByRoomId.getOrDefault(roomId, Map.of()).getOrDefault(levelZ, Set.of()),
                        floorCellsByRoomId.getOrDefault(roomId, Map.of()).get(levelZ)));
            }
            result.put(roomId, new StructureDescriptor(levels));
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
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
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static CellCoord requireStoredCellCenter(int persistedX2, int persistedY2, String label, long roomId, int levelZ) {
        return GridPoint2x.raw(persistedX2, persistedY2).asCell().orElseThrow(() -> new IllegalArgumentException(
                label + " must be a tile center for room " + roomId + " at level " + levelZ));
    }

    private static Map<Long, List<Room>> roomsByClusterId(List<Room> rooms) {
        Map<Long, List<Room>> result = new LinkedHashMap<>();
        for (Room room : rooms == null ? List.<Room>of() : rooms) {
            if (room != null) {
                result.computeIfAbsent(room.clusterId(), ignored -> new ArrayList<>()).add(room);
            }
        }
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
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
        return result.isEmpty() ? Map.of() : Map.copyOf(result);
    }

    private static String normalizedRoomName(long roomId, String name) {
        return name == null || name.isBlank() ? "Raum " + roomId : name.trim();
    }

    private static List<RoomCluster> normalizedClusters(List<RoomCluster> clusters) {
        if (clusters == null || clusters.isEmpty()) {
            return List.of();
        }
        List<RoomCluster> result = new ArrayList<>();
        Set<Long> seenClusterIds = new LinkedHashSet<>();
        for (RoomCluster cluster : clusters) {
            if (cluster == null) {
                continue;
            }
            if (cluster.clusterId() == null) {
                result.add(cluster);
                continue;
            }
            if (seenClusterIds.add(cluster.clusterId())) {
                result.add(cluster);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }

    private static Set<Long> roomIds(List<RoomCluster> clusters) {
        LinkedHashSet<Long> result = new LinkedHashSet<>();
        for (RoomCluster cluster : clusters == null ? List.<RoomCluster>of() : clusters) {
            if (cluster == null) {
                continue;
            }
            for (Room room : cluster.rooms()) {
                if (room != null && room.roomId() != null) {
                    result.add(room.roomId());
                }
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    @FunctionalInterface
    private interface ResultSetMapper<T> {
        T map(ResultSet rs) throws SQLException;
    }

}
