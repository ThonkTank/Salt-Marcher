package features.world.dungeonmap.application.room;

import database.DatabaseManager;
import features.world.dungeonmap.application.corridor.DungeonCorridorPersistenceService;
import features.world.dungeonmap.application.corridor.DungeonCorridorRoomRewriteService;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.loading.DungeonMapLoader;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.structures.cluster.ClusterRewrite;
import features.world.dungeonmap.model.structures.cluster.ClusterRewriteSplit;
import features.world.dungeonmap.model.structures.cluster.InternalBoundaryEdge;
import features.world.dungeonmap.model.structures.cluster.InternalBoundaryType;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorRewriteContext;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.persistence.ClusterBoundaryWrite;
import features.world.dungeonmap.persistence.DungeonRoomGeometryWriteMapper;
import features.world.dungeonmap.persistence.DungeonRoomWriteRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class DungeonRoomTopologyService {

    private final DungeonMapLoader mapLoader;
    private final DungeonRoomWriteRepository roomWriteRepository;
    private final DungeonRoomGeometryWriteMapper geometryWriteMapper;
    private final DungeonCorridorPersistenceService corridorPersistenceService;
    private final DungeonCorridorRoomRewriteService corridorRoomRewriteService;

    public DungeonRoomTopologyService(
            DungeonMapLoader mapLoader,
            DungeonRoomWriteRepository roomWriteRepository,
            DungeonRoomGeometryWriteMapper geometryWriteMapper,
            DungeonCorridorPersistenceService corridorPersistenceService,
            DungeonCorridorRoomRewriteService corridorRoomRewriteService
    ) {
        this.mapLoader = Objects.requireNonNull(mapLoader, "mapLoader");
        this.roomWriteRepository = Objects.requireNonNull(roomWriteRepository, "roomWriteRepository");
        this.geometryWriteMapper = Objects.requireNonNull(geometryWriteMapper, "geometryWriteMapper");
        this.corridorPersistenceService = Objects.requireNonNull(corridorPersistenceService, "corridorPersistenceService");
        this.corridorRoomRewriteService = Objects.requireNonNull(corridorRoomRewriteService, "corridorRoomRewriteService");
    }

    public void paint(long mapId, int levelZ, TileShape shape) throws SQLException {
        if (shape == null || shape.size() == 0) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                paint(conn, mapId, levelZ, shape);
                return null;
            });
        }
    }

    public void paint(Connection conn, long mapId, int levelZ, TileShape shape) throws SQLException {
        if (shape == null || shape.size() == 0) {
            return;
        }
        DungeonLayout layout = requireLayout(conn, mapId);
        List<RoomCluster> overlappingClusters = overlappingClustersAtLevel(layout, shape, levelZ).stream()
                .sorted(Comparator.comparing(cluster -> cluster.clusterId() == null ? Long.MAX_VALUE : cluster.clusterId()))
                .toList();
        if (overlappingClusters.isEmpty()) {
            createCluster(conn, mapId, levelZ, shape, nextRoomName(layout, new LinkedHashSet<>()));
            return;
        }

        ClusterRewrite rewrite = overlappingClusters.getFirst().applyPaint(shape, overlappingClusters, levelZ);
        if (rewrite.isNoOp()) {
            return;
        }

        ClusterRewrite persistedRewrite = persistClusterRewrite(conn, mapId, rewrite, levelZ);
        Map<Long, Corridor> corridorsById = applyCorridorCascade(
                layout,
                new LinkedHashMap<>(layout.corridorsById()),
                persistedRewrite);
        corridorPersistenceService.persistCorridors(conn, corridorsById);
    }

    public void delete(long mapId, int levelZ, TileShape shape) throws SQLException {
        if (shape == null || shape.size() == 0) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                delete(conn, mapId, levelZ, shape);
                return null;
            });
        }
    }

    public void delete(Connection conn, long mapId, int levelZ, TileShape shape) throws SQLException {
        if (shape == null || shape.size() == 0) {
            return;
        }
        DungeonLayout workingLayout = requireLayout(conn, mapId);
        Map<Long, Corridor> corridorsById = new LinkedHashMap<>(workingLayout.corridorsById());
        Set<String> reservedNames = new LinkedHashSet<>();
        for (Room room : workingLayout.rooms()) {
            if (room != null && room.name() != null && !room.name().isBlank()) {
                reservedNames.add(room.name());
            }
        }

        List<Long> affectedClusterIds = overlappingClustersAtLevel(workingLayout, shape, levelZ).stream()
                .map(RoomCluster::clusterId)
                .filter(Objects::nonNull)
                .sorted()
                .toList();
        for (Long clusterId : affectedClusterIds) {
            RoomCluster cluster = workingLayout.findCluster(clusterId);
            if (cluster == null) {
                continue;
            }
            DungeonLayout layoutSnapshot = workingLayout;
            ClusterRewrite rewrite = cluster.applyDelete(shape, () -> nextRoomName(layoutSnapshot, reservedNames), levelZ);
            if (rewrite.isNoOp()) {
                continue;
            }
            ClusterRewrite persistedRewrite = persistClusterRewrite(
                    conn,
                    mapId,
                    rewrite,
                    workingLayout.levelForCluster(rewrite.targetClusterId()));
            corridorsById = applyCorridorCascade(workingLayout, corridorsById, persistedRewrite);
            workingLayout = workingLayout.applying(persistedRewrite);
        }
        corridorPersistenceService.persistCorridors(conn, corridorsById);
    }

    public void createDefaultRoom(Connection conn, long mapId) throws SQLException {
        createCluster(conn, mapId, 0, TileShape.singleCell(new Point2i(0, 0)), "Eingang");
    }

    public void ensureTraversableCell(Connection conn, long mapId, Point2i cell, int levelZ) throws SQLException {
        if (cell == null) {
            return;
        }
        DungeonLayout layout = requireLayout(conn, mapId);
        if (layout.isTraversableCell(CubePoint.at(cell, levelZ))) {
            return;
        }
        paint(conn, mapId, levelZ, TileShape.singleCell(cell));
    }

    public void editBoundary(
            Connection conn,
            long mapId,
            long clusterId,
            VertexEdge edge,
            InternalBoundaryType type,
            boolean deleteBoundary
    ) throws SQLException {
        editBoundary(conn, mapId, clusterId, edge == null ? List.<VertexEdge>of() : List.of(edge), type, deleteBoundary);
    }

    public void editBoundary(
            Connection conn,
            long mapId,
            long clusterId,
            Collection<VertexEdge> edges,
            InternalBoundaryType type,
            boolean deleteBoundary
    ) throws SQLException {
        if (edges == null || edges.isEmpty()) {
            return;
        }
        DungeonLayout layout = requireLayout(conn, mapId);
        RoomCluster cluster = layout.findCluster(clusterId);
        if (cluster == null) {
            return;
        }
        ClusterRewrite rewrite = cluster.editBoundary(edges, type, deleteBoundary);
        if (rewrite == null) {
            return;
        }

        boolean affectsCorridors = !rewrite.affectedRoomIds().isEmpty();
        if (!affectsCorridors) {
            persistClusterRewrite(conn, mapId, rewrite, layout.levelForCluster(rewrite.targetClusterId()));
            return;
        }

        ClusterRewrite persistedRewrite = persistClusterRewrite(conn, mapId, rewrite, layout.levelForCluster(rewrite.targetClusterId()));
        Map<Long, Corridor> corridorsById = applyCorridorCascade(
                layout,
                new LinkedHashMap<>(layout.corridorsById()),
                persistedRewrite);
        corridorPersistenceService.persistCorridors(conn, corridorsById);
    }

    private Map<Long, Corridor> applyCorridorCascade(
            DungeonLayout beforeLayout,
            Map<Long, Corridor> corridorsById,
            ClusterRewrite rewrite
    ) {
        Set<Long> affectedCorridorIds = beforeLayout.corridorIdsAffectedBy(rewrite);
        // Services orchestrate affected scope and ordering; corridor-local membership rules stay on Corridor.
        corridorsById = corridorRoomRewriteService.applyRoomRewrite(beforeLayout, corridorsById, rewrite);
        DungeonLayout afterLayout = beforeLayout.applying(rewrite);
        CorridorRewriteContext rewriteContext = new CorridorRewriteContext(
                beforeLayout.corridorPlanningInput(),
                afterLayout.corridorPlanningInput(),
                affectedCorridorIds,
                rewrite.deletedClusterIds());
        return Corridor.rewriteAll(corridorsById, rewriteContext);
    }

    private void createCluster(Connection conn, long mapId, int levelZ, TileShape shape, String roomName) throws SQLException {
        long clusterId = roomWriteRepository.insertCluster(conn, mapId, geometryWriteMapper.toClusterGeometry(shape), levelZ);
        roomWriteRepository.replaceClusterEdges(conn, clusterId, shape.centerCell(), Map.of(levelZ, List.of()));
        roomWriteRepository.insertRoom(conn, mapId, clusterId, roomName, shape.centerCell(), levelZ);
    }

    private ClusterRewrite persistClusterRewrite(Connection conn, long mapId, ClusterRewrite rewrite, int levelZ) throws SQLException {
        if (rewrite == null || rewrite.targetClusterId() == null) {
            return rewrite;
        }
        for (Long roomId : rewrite.deletedRoomIds()) {
            if (roomId != null) {
                roomWriteRepository.deleteRoom(conn, roomId);
            }
        }
        if (rewrite.deletesCluster()) {
            roomWriteRepository.deleteCluster(conn, rewrite.targetClusterId());
            return rewrite;
        }
        List<ClusterRewriteSplit> realizedSplitClusters = new java.util.ArrayList<>();
        for (ClusterRewriteSplit splitCluster : rewrite.splitClusters()) {
            long splitClusterId = roomWriteRepository.insertCluster(
                    conn,
                    mapId,
                    geometryWriteMapper.toClusterGeometry(shapesByLevel(splitCluster.rooms())),
                    primaryLevel(splitCluster.rooms(), levelZ));
            roomWriteRepository.replaceClusterEdges(
                    conn,
                    splitClusterId,
                    splitCluster.clusterCenter(),
                    boundaryWritesByLevel(splitCluster.rooms(), splitCluster.persistedBoundaries()));
            realizedSplitClusters.add(splitCluster.withClusterId(splitClusterId));
        }
        ClusterRewrite realizedRewrite = rewrite.withSplitClusters(realizedSplitClusters);
        roomWriteRepository.updateClusterGeometry(
                conn,
                realizedRewrite.targetClusterId(),
                geometryWriteMapper.toClusterGeometry(shapesByLevel(realizedRewrite.rooms())),
                primaryLevel(realizedRewrite.rooms(), levelZ));
        roomWriteRepository.replaceClusterEdges(
                conn,
                realizedRewrite.targetClusterId(),
                realizedRewrite.clusterCenter(),
                boundaryWritesByLevel(realizedRewrite.rooms(), realizedRewrite.persistedBoundaries()));
        persistRooms(conn, mapId, realizedRewrite.targetClusterId(), realizedRewrite.rooms());
        for (ClusterRewriteSplit splitCluster : realizedRewrite.splitClusters()) {
            persistRooms(conn, mapId, splitCluster.clusterId(), splitCluster.rooms());
        }
        for (Long deletedClusterId : realizedRewrite.deletedClusterIds()) {
            if (deletedClusterId != null && !deletedClusterId.equals(realizedRewrite.targetClusterId())) {
                roomWriteRepository.deleteCluster(conn, deletedClusterId);
            }
        }
        return realizedRewrite;
    }

    private static ClusterBoundaryWrite.Type toBoundaryWriteType(InternalBoundaryType type) {
        return type == InternalBoundaryType.DOOR ? ClusterBoundaryWrite.Type.DOOR : ClusterBoundaryWrite.Type.WALL;
    }

    private static List<ClusterBoundaryWrite> toBoundaryWrites(List<InternalBoundaryEdge> boundaries) {
        if (boundaries == null || boundaries.isEmpty()) {
            return List.of();
        }
        return boundaries.stream()
                .map(DungeonRoomTopologyService::toBoundaryWrite)
                .filter(Objects::nonNull)
                .toList();
    }

    private static ClusterBoundaryWrite toBoundaryWrite(InternalBoundaryEdge boundary) {
        if (boundary == null || boundary.cell() == null || boundary.direction() == null) {
            return null;
        }
        return new ClusterBoundaryWrite(boundary.cell(), boundary.direction(), toBoundaryWriteType(boundary.type()));
    }

    private static Map<Integer, List<ClusterBoundaryWrite>> boundaryWritesByLevel(List<Room> rooms, List<InternalBoundaryEdge> boundaries) {
        Map<Integer, TileShape> clusterShapesByLevel = shapesByLevel(rooms);
        Map<Integer, List<ClusterBoundaryWrite>> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, TileShape> entry : clusterShapesByLevel.entrySet()) {
            if (entry == null || entry.getKey() == null || entry.getValue() == null) {
                continue;
            }
            Set<Point2i> clusterCells = entry.getValue().absoluteCells();
            List<ClusterBoundaryWrite> levelWrites = (boundaries == null ? List.<InternalBoundaryEdge>of() : boundaries).stream()
                    .filter(boundary -> boundaryExistsAtLevel(boundary, clusterCells))
                    .map(DungeonRoomTopologyService::toBoundaryWrite)
                    .filter(Objects::nonNull)
                    .toList();
            result.put(entry.getKey(), levelWrites);
        }
        return Map.copyOf(result);
    }

    private static boolean boundaryExistsAtLevel(InternalBoundaryEdge boundary, Set<Point2i> clusterCells) {
        if (boundary == null || boundary.cell() == null || boundary.direction() == null || clusterCells == null || clusterCells.isEmpty()) {
            return false;
        }
        VertexEdge edge = VertexEdge.betweenCellAndStep(boundary.cell(), boundary.direction());
        return clusterCells.containsAll(edge.touchingCells());
    }

    private void persistRooms(
            Connection conn,
            long mapId,
            long clusterId,
            List<Room> rooms
    ) throws SQLException {
        for (Room room : rooms) {
            if (room == null) {
                continue;
            }
            if (room.roomId() == null) {
                long roomId = roomWriteRepository.insertRoom(
                        conn,
                        mapId,
                        clusterId,
                        room.name(),
                        room.anchorsByLevel(),
                        room.primaryLevel());
                if (roomId <= 0) {
                    throw new SQLException("Raum konnte nicht angelegt werden");
                }
                continue;
            }
            roomWriteRepository.reassignRoomCluster(conn, room.roomId(), clusterId);
            roomWriteRepository.updateRoom(conn, room.roomId(), room.name(), room.anchorsByLevel(), room.primaryLevel());
            roomWriteRepository.replaceRoomFloors(conn, room.roomId(), room.anchorsByLevel());
        }
    }

    private static Map<Integer, TileShape> shapesByLevel(List<Room> rooms) {
        Map<Integer, java.util.Set<Point2i>> cellsByLevel = new LinkedHashMap<>();
        for (Room room : rooms == null ? List.<Room>of() : rooms) {
            if (room == null) {
                continue;
            }
            for (Map.Entry<Integer, features.world.dungeonmap.model.objects.Floor> entry : room.floors().entrySet()) {
                if (entry == null || entry.getKey() == null || entry.getValue() == null) {
                    continue;
                }
                cellsByLevel.computeIfAbsent(entry.getKey(), ignored -> new java.util.LinkedHashSet<>())
                        .addAll(entry.getValue().shape().absoluteCells());
            }
        }
        if (cellsByLevel.isEmpty()) {
            return Map.of(0, TileShape.empty());
        }
        Map<Integer, TileShape> result = new LinkedHashMap<>();
        for (Map.Entry<Integer, java.util.Set<Point2i>> entry : cellsByLevel.entrySet()) {
            result.put(entry.getKey(), TileShape.fromAbsoluteCells(entry.getValue()));
        }
        return Map.copyOf(result);
    }

    private static int primaryLevel(List<Room> rooms, int fallbackLevel) {
        return shapesByLevel(rooms).keySet().stream()
                .mapToInt(Integer::intValue)
                .min()
                .orElse(fallbackLevel);
    }

    private static List<RoomCluster> overlappingClustersAtLevel(DungeonLayout layout, TileShape shape, int levelZ) {
        return layout.overlappingClusters(shape).stream()
                .filter(cluster -> cluster != null && cluster.rooms().stream()
                        .anyMatch(room -> room != null
                                && room.levels().contains(levelZ)))
                .toList();
    }

    private static String nextRoomName(DungeonLayout layout, Set<String> reservedNames) {
        Set<String> used = new LinkedHashSet<>(reservedNames);
        for (Room room : layout.rooms()) {
            if (room != null && room.name() != null && !room.name().isBlank()) {
                used.add(room.name());
            }
        }
        int next = 1;
        while (used.contains("Raum " + next)) {
            next++;
        }
        String result = "Raum " + next;
        used.add(result);
        reservedNames.add(result);
        return result;
    }

    private DungeonLayout requireLayout(Connection conn, long mapId) throws SQLException {
        DungeonLayout layout = mapLoader.loadLayout(conn, mapId);
        if (layout == null) {
            throw new SQLException("Dungeon " + mapId + " konnte nicht geladen werden");
        }
        return layout;
    }
}
