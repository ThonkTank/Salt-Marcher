package features.world.dungeon.dungoenmap.cluster.application;

import database.DatabaseManager;
import features.world.dungeon.application.support.DungeonTransactionRunner;
import features.world.dungeon.dungoenmap.cluster.model.ClusterStructureEditor;
import features.world.dungeon.dungoenmap.cluster.model.Cluster;
import features.world.dungeon.dungoenmap.cluster.repository.DungeonClusterRepository;
import features.world.dungeon.dungoenmap.model.DungeonMap;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegment;
import features.world.dungeon.geometry.GridArea;
import features.world.dungeon.geometry.GridBoundary;
import features.world.dungeon.geometry.GridTranslation;
import features.world.dungeon.dungoenmap.structure.model.Structure;
import features.world.dungeon.dungoenmap.structure.model.StructureMutation;
import features.world.dungeon.dungoenmap.structure.model.StructureSpecification;
import features.world.dungeon.dungoenmap.structure.model.boundary.door.DoorRef;
import features.world.dungeon.dungoenmap.structure.model.surface.StructureSurface;
import features.world.dungeon.model.structures.connection.ConnectionEndpoint;
import features.world.dungeon.model.structures.connection.DoorConnectionCarrier;
import features.world.dungeon.model.structures.connection.DungeonConnection;
import features.world.dungeon.model.structures.connection.StairConnectionCarrier;
import features.world.dungeon.dungoenmap.corridor.model.Corridor;
import features.world.dungeon.dungoenmap.corridor.model.CorridorNode;
import features.world.dungeon.model.structures.room.Room;
import features.world.dungeon.model.structures.stair.Stair;
import features.world.dungeon.model.structures.stair.StairExit;
import features.world.dungeon.model.structures.stair.DungeonStair;
import features.world.dungeon.model.structures.transition.DungeonTransition;
import features.world.dungeon.dungoenmap.corridor.repository.DungeonCorridorRepository;
import features.world.dungeon.dungoenmap.repository.DungeonMapRepository;
import features.world.dungeon.repository.DungeonRoomRepository;
import features.world.dungeon.repository.DungeonTransitionRepository;

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
import java.util.function.Supplier;
import java.util.stream.Collectors;

/**
 * Central cluster workflow owner for editor-visible cluster mutations.
 *
 * <p>Paint, delete, boundary edits, cluster moves, and traversability bootstrap all converge
 * here so tools and neighboring application flows do not keep parallel room workflow owners alive.
 */
public final class DungeonClusterApplicationService {

    private final DungeonMapRepository mapRepository;
    private final DungeonClusterRepository clusterRepository;
    private final DungeonCorridorRepository corridorRepository;
    private final DungeonRoomRepository roomRepository;
    private final DungeonTransitionRepository transitionRepository;

    public DungeonClusterApplicationService(
            DungeonMapRepository mapRepository,
            DungeonClusterRepository clusterRepository,
            DungeonCorridorRepository corridorRepository,
            DungeonRoomRepository roomRepository,
            DungeonTransitionRepository transitionRepository
    ) {
        this.mapRepository = Objects.requireNonNull(mapRepository, "mapRepository");
        this.clusterRepository = Objects.requireNonNull(clusterRepository, "clusterRepository");
        this.corridorRepository = Objects.requireNonNull(corridorRepository, "corridorRepository");
        this.roomRepository = Objects.requireNonNull(roomRepository, "roomRepository");
        this.transitionRepository = Objects.requireNonNull(transitionRepository, "transitionRepository");
    }

    public void paintCells(long mapId, int levelZ, GridArea cells) throws SQLException {
        GridArea resolvedCells = cells == null ? GridArea.empty() : cells.onLevel(levelZ);
        if (resolvedCells.isEmpty()) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                paintCells(conn, mapId, levelZ, resolvedCells);
                return null;
            });
        }
    }

    public void deleteCells(long mapId, int levelZ, GridArea cells) throws SQLException {
        GridArea resolvedCells = cells == null ? GridArea.empty() : cells.onLevel(levelZ);
        if (resolvedCells.isEmpty()) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                deleteCells(conn, mapId, levelZ, resolvedCells);
                return null;
            });
        }
    }

    public void addFloorCells(long mapId, int levelZ, GridArea cells) throws SQLException {
        GridArea resolvedCells = cells == null ? GridArea.empty() : cells.onLevel(levelZ);
        if (resolvedCells.isEmpty()) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                editFloorCells(conn, mapId, levelZ, resolvedCells, false);
                return null;
            });
        }
    }

    public void deleteFloorCells(long mapId, int levelZ, GridArea cells) throws SQLException {
        GridArea resolvedCells = cells == null ? GridArea.empty() : cells.onLevel(levelZ);
        if (resolvedCells.isEmpty()) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                editFloorCells(conn, mapId, levelZ, resolvedCells, true);
                return null;
            });
        }
    }

    public void createWallPath(
            long mapId,
            long clusterId,
            int levelZ,
            GridBoundary segments
    ) throws SQLException {
        GridBoundary resolvedSegments = segments == null ? GridBoundary.empty() : segments;
        if (resolvedSegments.isEmpty()) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                createWallPath(conn, mapId, clusterId, levelZ, resolvedSegments);
                return null;
            });
        }
    }

    public void deleteWallPath(
            long mapId,
            long clusterId,
            int levelZ,
            GridBoundary segments
    ) throws SQLException {
        GridBoundary resolvedSegments = segments == null ? GridBoundary.empty() : segments;
        if (resolvedSegments.isEmpty()) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                deleteWallPath(conn, mapId, clusterId, levelZ, resolvedSegments);
                return null;
            });
        }
    }

    public void createDoor(long mapId, long clusterId, int levelZ, GridBoundary segments) throws SQLException {
        editDoor(mapId, clusterId, levelZ, segments, false);
    }

    public void deleteDoor(long mapId, long clusterId, int levelZ, GridBoundary segments) throws SQLException {
        editDoor(mapId, clusterId, levelZ, segments, true);
    }

    public void createExteriorDoor(long mapId, long clusterId, int levelZ, GridBoundary segments) throws SQLException {
        editExteriorDoor(mapId, clusterId, levelZ, segments, false);
    }

    public void deleteExteriorDoor(long mapId, long clusterId, int levelZ, GridBoundary segments) throws SQLException {
        editExteriorDoor(mapId, clusterId, levelZ, segments, true);
    }

    public void moveDoor(MoveDoorRequest request) throws SQLException {
        MoveDoorRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.mapId() <= 0
                || resolvedRequest.clusterId() <= 0
                || resolvedRequest.sourceBoundarySegment() == null
                || resolvedRequest.targetBoundarySegment() == null) {
            throw new IllegalArgumentException("Local door move requires mapId, clusterId, source boundary, and target boundary");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonMap layout = requireLayout(conn, resolvedRequest.mapId());
                Cluster cluster = layout.findCluster(resolvedRequest.clusterId());
                if (cluster == null) {
                    return null;
                }
                Cluster updatedCluster = cluster.moveDoor(
                        resolvedRequest.levelZ(),
                        resolvedRequest.sourceBoundarySegment(),
                        resolvedRequest.targetBoundarySegment());
                if (updatedCluster != null) {
                    replaceClusters(conn, resolvedRequest.mapId(), List.of(cluster), List.of(updatedCluster));
                }
                return null;
            });
        }
    }

    public void paintCells(Connection conn, long mapId, int levelZ, GridArea cells) throws SQLException {
        DungeonMap layout = requireLayout(conn, mapId);
        Set<GridPoint> requestedCells = cells.cells();
        List<Cluster> overlappingClusters = overlappingClustersAtLevel(layout, requestedCells, levelZ).stream()
                .sorted(Comparator.comparing(cluster -> cluster.clusterId() == null ? Long.MAX_VALUE : cluster.clusterId()))
                .toList();
        if (overlappingClusters.isEmpty()) {
            createClusterWithRoom(conn, mapId, levelZ, requestedCells, nextRoomName(layout, new LinkedHashSet<>()));
            return;
        }

        Cluster mergedCluster = ClusterStructureEditor.applyPaint(
                overlappingClusters.getFirst(),
                requestedCells,
                overlappingClusters,
                levelZ);
        if (mergedCluster == null) {
            return;
        }

        persistClusterRewrite(conn, mapId, layout, overlappingClusters, List.of(mergedCluster));
    }

    public void deleteCells(Connection conn, long mapId, int levelZ, GridArea cells) throws SQLException {
        DungeonMap workingLayout = requireLayout(conn, mapId);
        Set<String> reservedNames = new LinkedHashSet<>();
        for (Room room : rooms(workingLayout)) {
            if (room != null && room.name() != null && !room.name().isBlank()) {
                reservedNames.add(room.name());
            }
        }

        List<Long> affectedClusterIds = overlappingClustersAtLevel(workingLayout, cells.cells(), levelZ).stream()
                .map(Cluster::clusterId)
                .filter(Objects::nonNull)
                .sorted()
                .toList();
        for (Long clusterId : affectedClusterIds) {
            Cluster cluster = workingLayout.findCluster(clusterId);
            if (cluster == null) {
                continue;
            }
            DungeonMap layoutSnapshot = workingLayout;
            List<Cluster> finalClusters = ClusterStructureEditor.assignGeneratedClusterRoomNames(
                    ClusterStructureEditor.applyDelete(cluster, cells.cells(), levelZ),
                    () -> nextRoomName(layoutSnapshot, reservedNames));
            if (finalClusters == null) {
                continue;
            }
            persistClusterRewrite(conn, mapId, workingLayout, List.of(cluster), finalClusters);
            workingLayout = requireLayout(conn, mapId);
        }
    }

    public void editFloorCells(
            Connection conn,
            long mapId,
            int levelZ,
            GridArea cells,
            boolean deleteFloor
    ) throws SQLException {
        if (cells == null || cells.isEmpty()) {
            return;
        }
        DungeonMap workingLayout = requireLayout(conn, mapId);
        Set<GridPoint> requestedCells = cells.cells();
        List<Room> affectedRooms = overlappingRoomsAtLevel(workingLayout, requestedCells, levelZ);
        if (affectedRooms.isEmpty()) {
            return;
        }

        java.util.Map<Long, Set<GridPoint>> requestedByClusterId = new java.util.LinkedHashMap<>();
        for (Room room : affectedRooms) {
            if (room == null || room.roomId() == null) {
                continue;
            }
            Structure roomStructure = roomStructure(workingLayout, room);
            Set<GridPoint> requestedRoomCells = intersect(
                    roomStructure.surfaceAtLevel(levelZ).surface().cells(),
                    requestedCells);
            if (requestedRoomCells.isEmpty()) {
                continue;
            }
            if (deleteFloor) {
                Set<GridPoint> removedFloorCells = intersect(
                        roomStructure.surfaceAtLevel(levelZ).floor().cells(),
                        requestedRoomCells);
                if (removedFloorCells.isEmpty()) {
                    continue;
                }
                validateFloorDelete(workingLayout, room, levelZ, removedFloorCells);
            }
            requestedByClusterId.computeIfAbsent(room.clusterId(), ignored -> new LinkedHashSet<>()).addAll(requestedRoomCells);
        }

        for (Long clusterId : requestedByClusterId.keySet().stream().sorted().toList()) {
            Cluster cluster = workingLayout.findCluster(clusterId);
            if (cluster == null) {
                continue;
            }
            Set<GridPoint> clusterRequestedCells = requestedByClusterId.getOrDefault(clusterId, Set.of());
            StructureSurface structureSurface = cluster.surfaceAtLevel(levelZ);
            Set<GridPoint> currentFloorCells = new LinkedHashSet<>(structureSurface.floor().cells());
            Set<GridPoint> nextFloorCells = new LinkedHashSet<>(currentFloorCells);
            boolean changed;
            if (deleteFloor) {
                changed = nextFloorCells.removeAll(clusterRequestedCells);
            } else {
                changed = nextFloorCells.addAll(clusterRequestedCells);
            }
            if (!changed) {
                continue;
            }
            Cluster updatedCluster = new Cluster(
                    cluster.clusterId(),
                    cluster.structureObjectId(),
                    cluster.mapId(),
                    cluster.center(),
                    cluster.mutated(new StructureMutation.FloorCellsEdit(
                            levelZ,
                            GridArea.of(requestedCells),
                            deleteFloor ? StructureMutation.CellEditMode.REMOVE : StructureMutation.CellEditMode.ADD)),
                    cluster.roomTopology().rooms());
            persistClusterRewrite(conn, mapId, workingLayout, List.of(cluster), List.of(updatedCluster));
            workingLayout = requireLayout(conn, mapId);
        }
    }

    public void createDefaultRoom(Connection conn, long mapId) throws SQLException {
        // Brand-new dungeons must bootstrap their first room without rehydrating an empty layout first.
        createClusterWithRoom(conn, mapId, 0, Set.of(GridPoint.cell(0, 0, 0)), "Raum 1");
    }

    private void createClusterWithRoom(
            Connection conn,
            long mapId,
            int levelZ,
            Set<GridPoint> cells,
            String roomName
    ) throws SQLException {
        Set<GridPoint> resolvedCells = cells == null ? Set.of() : Set.copyOf(cells);
        if (resolvedCells.isEmpty()) {
            return;
        }
        GridPoint center = GridArea.of(resolvedCells).center();
        Structure structure = Structure.fromSpecification(StructureSpecification.ofLevel(
                levelZ,
                new StructureSpecification.LevelSpecification(
                        center,
                        GridArea.of(resolvedCells),
                        GridArea.of(resolvedCells),
                        List.of(),
                        List.of())));
        DungeonClusterRepository.PersistedCluster persistedCluster =
                clusterRepository.createCluster(conn, mapId, center, structure);
        roomRepository.saveRooms(conn, mapId, persistedCluster.clusterId(), List.of(
                new Room(null, mapId, persistedCluster.clusterId(), roomName, java.util.Map.of(levelZ, center), null)));
    }

    public void move(long mapId, long clusterId, GridTranslation translation) throws SQLException {
        GridTranslation resolvedTranslation = translation == null ? GridTranslation.none() : translation;
        if (resolvedTranslation.isZero()) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonMap layout = requireLayout(conn, mapId);
                DungeonMap movedLayout = layout.withMovedCluster(clusterId, resolvedTranslation);
                Cluster cluster = requireCluster(movedLayout, clusterId);
                saveMovedCluster(conn, cluster);
                persistUpdatedCorridors(conn, layout, movedLayout);
                return null;
            });
        }
    }

    public void ensureTraversableCell(Connection conn, long mapId, GridPoint cell, int levelZ) throws SQLException {
        if (cell == null) {
            return;
        }
        DungeonMap layout = requireLayout(conn, mapId);
        if (layout.isTraversableCell(cell, levelZ)) {
            return;
        }
        Room room = roomAtCell(layout, cell, levelZ);
        if (room != null) {
            editFloorCells(conn, mapId, levelZ, GridArea.of(Set.of(cell)), false);
            return;
        }
        paintCells(conn, mapId, levelZ, GridArea.of(Set.of(cell)));
    }

    public void createWallPath(
            Connection conn,
            long mapId,
            long clusterId,
            int levelZ,
            GridBoundary segments
    ) throws SQLException {
        if (segments == null || segments.isEmpty()) {
            return;
        }
        DungeonMap layout = requireLayout(conn, mapId);
        Cluster cluster = layout.findCluster(clusterId);
        if (cluster == null) {
            return;
        }
        Cluster updatedCluster = cluster.createWallPath(levelZ, segments);
        if (updatedCluster == null) {
            return;
        }

        persistClusterRewrite(conn, mapId, layout, List.of(cluster), List.of(updatedCluster));
    }

    public void deleteWallPath(
            Connection conn,
            long mapId,
            long clusterId,
            int levelZ,
            GridBoundary segments
    ) throws SQLException {
        if (segments == null || segments.isEmpty()) {
            return;
        }
        DungeonMap layout = requireLayout(conn, mapId);
        Cluster cluster = layout.findCluster(clusterId);
        if (cluster == null) {
            return;
        }
        Cluster updatedCluster = cluster.deleteWallPath(levelZ, segments);
        if (updatedCluster == null) {
            return;
        }

        persistClusterRewrite(conn, mapId, layout, List.of(cluster), List.of(updatedCluster));
    }

    private void editDoor(
            long mapId,
            long clusterId,
            int levelZ,
            GridBoundary segments,
            boolean deleteDoor
    ) throws SQLException {
        if (segments == null || segments.isEmpty()) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                editDoor(conn, mapId, clusterId, levelZ, segments, deleteDoor);
                return null;
            });
        }
    }

    private void editDoor(
            Connection conn,
            long mapId,
            long clusterId,
            int levelZ,
            GridBoundary segments,
            boolean deleteDoor
    ) throws SQLException {
        DungeonMap layout = requireLayout(conn, mapId);
        Cluster cluster = layout.findCluster(clusterId);
        if (cluster == null) {
            return;
        }
        GridBoundary editableSegments = GridBoundary.of(segments.segments().stream()
                .filter(Objects::nonNull)
                .filter(segment2x -> deleteDoor
                        ? cluster.canDeleteDoor(levelZ, segment2x)
                        : cluster.canCreateDoor(levelZ, segment2x))
                .toList());
        if (editableSegments.isEmpty()) {
            return;
        }
        Cluster updatedCluster = cluster.withDoorSegments(levelZ, editableSegments, deleteDoor);
        if (updatedCluster == null) {
            return;
        }
        replaceClusters(conn, mapId, List.of(cluster), List.of(updatedCluster));
    }

    private void editExteriorDoor(
            long mapId,
            long clusterId,
            int levelZ,
            GridBoundary segments,
            boolean deleteDoor
    ) throws SQLException {
        if (segments == null || segments.isEmpty()) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                editExteriorDoor(conn, mapId, clusterId, levelZ, segments, deleteDoor);
                return null;
            });
        }
    }

    private void editExteriorDoor(
            Connection conn,
            long mapId,
            long clusterId,
            int levelZ,
            GridBoundary segments,
            boolean deleteDoor
    ) throws SQLException {
        DungeonMap layout = requireLayout(conn, mapId);
        Cluster cluster = layout.findCluster(clusterId);
        Cluster projectedCluster = cluster == null ? null : cluster.projectedToLevel(levelZ);
        if (projectedCluster == null) {
            return;
        }
        GridBoundary editableSegments = GridBoundary.of(segments.segments().stream()
                .filter(Objects::nonNull)
                .filter(segment2x -> deleteDoor
                        ? projectedCluster.canDeleteExteriorDoor(levelZ, segment2x)
                        : projectedCluster.canCreateExteriorDoor(levelZ, segment2x))
                .toList());
        if (editableSegments.isEmpty()) {
            return;
        }
        Cluster updatedCluster = cluster.withExteriorDoors(levelZ, editableSegments, deleteDoor);
        if (updatedCluster == null || updatedCluster == cluster) {
            return;
        }
        replaceClusters(conn, mapId, List.of(cluster), List.of(updatedCluster));
    }

    private static List<Cluster> overlappingClustersAtLevel(DungeonMap layout, Set<GridPoint> cells, int levelZ) {
        return layout.overlappingClusters(GridArea.of(cells)).stream()
                .filter(cluster -> cluster != null && cluster.roomTopology().rooms().stream()
                        .anyMatch(room -> room != null
                                && cluster.roomTopology().roomLevels(room).contains(levelZ)))
                .toList();
    }

    private static List<Room> overlappingRoomsAtLevel(DungeonMap layout, Set<GridPoint> cells, int levelZ) {
        if (layout == null || cells == null || cells.isEmpty()) {
            return List.of();
        }
        return rooms(layout).stream()
                .filter(room -> room != null
                        && room.roomId() != null
                        && !intersect(roomStructure(layout, room).surfaceAtLevel(levelZ).surface().cells(), cells).isEmpty())
                .sorted(Comparator.comparing(Room::roomId))
                .toList();
    }

    private static String nextRoomName(DungeonMap layout, Set<String> reservedNames) {
        Set<String> used = new LinkedHashSet<>(reservedNames);
        for (Room room : rooms(layout)) {
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

    private DungeonMap requireLayout(Connection conn, long mapId) throws SQLException {
        DungeonMap layout = mapRepository.loadMap(conn, mapId);
        if (layout == null) {
            throw new SQLException("Dungeon " + mapId + " konnte nicht geladen werden");
        }
        return layout;
    }

    private static Cluster requireCluster(DungeonMap layout, long clusterId) throws SQLException {
        Cluster cluster = layout == null ? null : layout.findCluster(clusterId);
        if (cluster == null) {
            throw new SQLException("Cluster " + clusterId + " existiert nicht");
        }
        return cluster;
    }

    private void persistClusterRewrite(
            Connection conn,
            long mapId,
            DungeonMap originalLayout,
            List<Cluster> originalClusters,
            List<Cluster> finalClusters
    ) throws SQLException {
        if (conn == null || originalLayout == null) {
            return;
        }
        Set<Long> affectedRoomIds = affectedRoomIds(originalClusters);
        DungeonMap rewrittenLayout = originalLayout.withReplacedClusters(originalClusters, finalClusters);
        validateRoomRewriteCorridors(originalLayout, rewrittenLayout, affectedRoomIds);
        validateRoomRewriteTransitions(originalLayout, rewrittenLayout, affectedRoomIds);
        replaceClusters(conn, mapId, originalClusters, finalClusters);
        if (affectedRoomIds.isEmpty()) {
            return;
        }
        DungeonMap persistedRoomLayout = loadRoomRewriteLayout(conn, originalLayout, mapId);
        persistReboundCorridors(conn, originalLayout, persistedRoomLayout, affectedRoomIds);
        persistReboundTransitions(conn, originalLayout, persistedRoomLayout, affectedRoomIds);
    }

    private void saveMovedCluster(Connection conn, Cluster cluster) throws SQLException {
        DungeonClusterRepository.PersistedCluster persistedCluster = clusterRepository.saveCluster(conn, cluster);
        roomRepository.saveRooms(
                conn,
                cluster.mapId(),
                persistedCluster.clusterId(),
                persistedCluster.structure().roomTopology().rooms());
    }

    private void replaceClusters(
            Connection conn,
            long mapId,
            List<Cluster> originalClusters,
            List<Cluster> finalClusters
    ) throws SQLException {
        List<Cluster> resolvedOriginalClusters = normalizedClusters(originalClusters);
        List<Cluster> resolvedFinalClusters = normalizedClusters(finalClusters);
        if (resolvedOriginalClusters.isEmpty() && resolvedFinalClusters.isEmpty()) {
            return;
        }

        Set<Long> finalRoomIds = roomIds(resolvedFinalClusters);
        LinkedHashSet<Long> removedRoomIds = new LinkedHashSet<>();
        for (Long roomId : roomIds(resolvedOriginalClusters)) {
            if (roomId != null && !finalRoomIds.contains(roomId)) {
                removedRoomIds.add(roomId);
            }
        }
        roomRepository.deleteRooms(conn, removedRoomIds);

        LinkedHashSet<Long> retainedClusterIds = new LinkedHashSet<>();
        for (Cluster cluster : resolvedFinalClusters) {
            if (cluster == null || cluster.clusterId() == null) {
                continue;
            }
            DungeonClusterRepository.PersistedCluster persistedCluster = clusterRepository.saveCluster(conn, cluster);
            retainedClusterIds.add(persistedCluster.clusterId());
            roomRepository.saveRooms(
                    conn,
                    mapId,
                    persistedCluster.clusterId(),
                    persistedCluster.structure().roomTopology().rooms());
        }

        for (Cluster cluster : resolvedFinalClusters) {
            if (cluster == null || cluster.clusterId() != null) {
                continue;
            }
            DungeonClusterRepository.PersistedCluster persistedCluster =
                    clusterRepository.createCluster(conn, mapId, cluster.center(), cluster);
            roomRepository.saveRooms(
                    conn,
                    mapId,
                    persistedCluster.clusterId(),
                    persistedCluster.structure().roomTopology().rooms());
        }

        for (Cluster cluster : resolvedOriginalClusters) {
            if (cluster == null || cluster.clusterId() == null || retainedClusterIds.contains(cluster.clusterId())) {
                continue;
            }
            clusterRepository.deleteCluster(conn, cluster);
        }
    }

    private void persistUpdatedCorridors(Connection conn, DungeonMap originalLayout, DungeonMap movedLayout) throws SQLException {
        if (conn == null || originalLayout == null || movedLayout == null) {
            return;
        }
        for (var originalCorridor : originalLayout.corridors()) {
            if (originalCorridor == null || originalCorridor.corridorId() == null) {
                continue;
            }
            var movedCorridor = movedLayout.findCorridor(originalCorridor.corridorId());
            if (movedCorridor != null && movedCorridor != originalCorridor) {
                corridorRepository.save(conn, movedCorridor, movedLayout);
            }
        }
    }

    private void validateRoomRewriteCorridors(
            DungeonMap originalLayout,
            DungeonMap rewrittenLayout,
            Set<Long> affectedRoomIds
    ) {
        if (originalLayout != null) {
            originalLayout.validateCorridorRoomRewrite(rewrittenLayout, affectedRoomIds);
        }
    }

    private void persistReboundCorridors(
            Connection conn,
            DungeonMap originalLayout,
            DungeonMap rewrittenRoomLayout,
            Set<Long> affectedRoomIds
    ) throws SQLException {
        if (conn == null || originalLayout == null || rewrittenRoomLayout == null || affectedRoomIds == null || affectedRoomIds.isEmpty()) {
            return;
        }
        Map<Long, Corridor> originalCorridorsById = originalLayout.corridors().stream()
                .filter(Objects::nonNull)
                .filter(corridor -> corridor.corridorId() != null)
                .collect(Collectors.toMap(Corridor::corridorId, corridor -> corridor, (left, right) -> left, LinkedHashMap::new));
        for (Corridor reboundCorridor : originalLayout.reboundCorridors(rewrittenRoomLayout, affectedRoomIds)) {
            Corridor originalCorridor = reboundCorridor == null ? null : originalCorridorsById.get(reboundCorridor.corridorId());
            if (reboundCorridor == null || originalCorridor == null) {
                continue;
            }
            if (reboundCorridor != originalCorridor) {
                corridorRepository.save(conn, reboundCorridor, rewrittenRoomLayout);
            }
        }
    }

    private void validateRoomRewriteTransitions(
            DungeonMap originalLayout,
            DungeonMap rewrittenLayout,
            Set<Long> affectedRoomIds
    ) {
        if (originalLayout == null || rewrittenLayout == null || affectedRoomIds == null || affectedRoomIds.isEmpty()) {
            return;
        }
        for (DungeonTransition transition : originalLayout.transitions()) {
            if (touchesAffectedRooms(transition, affectedRoomIds)) {
                reboundTransitionLocalConnection(rewrittenLayout, transition, affectedRoomIds, false);
            }
        }
    }

    private void persistReboundTransitions(
            Connection conn,
            DungeonMap originalLayout,
            DungeonMap rewrittenRoomLayout,
            Set<Long> affectedRoomIds
    ) throws SQLException {
        if (conn == null || originalLayout == null || rewrittenRoomLayout == null || affectedRoomIds == null || affectedRoomIds.isEmpty()) {
            return;
        }
        for (DungeonTransition transition : originalLayout.transitions()) {
            if (transition == null || transition.transitionId() == null || !touchesAffectedRooms(transition, affectedRoomIds)) {
                continue;
            }
            DungeonConnection reboundConnection = reboundTransitionLocalConnection(
                    rewrittenRoomLayout,
                    transition,
                    affectedRoomIds,
                    true);
            if (!Objects.equals(reboundConnection, transition.localConnection())) {
                transitionRepository.updateLocalConnection(
                        conn,
                        transition.transitionId(),
                        reboundConnection,
                        transition.stairPlacementSpec());
            }
        }
    }

    private DungeonMap loadRoomRewriteLayout(Connection conn, DungeonMap originalLayout, long mapId) throws SQLException {
        List<Room> rooms = roomRepository.loadRooms(conn, mapId);
        List<Cluster> clusters = clusterRepository.loadClusters(conn, mapId, rooms);
        return new DungeonMap(
                mapId,
                originalLayout == null ? null : originalLayout.name(),
                originalLayout == null ? List.of() : originalLayout.corridors(),
                clusters,
                originalLayout == null ? List.of() : originalLayout.stairs(),
                originalLayout == null ? List.of() : originalLayout.transitions(),
                clusterRepository.loadClusterLevels(conn, mapId));
    }

    private static boolean touchesAffectedRooms(Corridor corridor, Set<Long> affectedRoomIds) {
        if (corridor == null || affectedRoomIds == null || affectedRoomIds.isEmpty()) {
            return false;
        }
        return corridor.connectedRoomIds().stream().anyMatch(affectedRoomIds::contains);
    }

    private static boolean touchesAffectedRooms(DungeonTransition transition, Set<Long> affectedRoomIds) {
        if (transition == null
                || transition.localConnection() == null
                || affectedRoomIds == null
                || affectedRoomIds.isEmpty()) {
            return false;
        }
        return transition.localConnection().endpoints().stream()
                .filter(Objects::nonNull)
                .filter(endpoint -> endpoint.type() == features.world.dungeon.model.structures.connection.ConnectionEndpointType.ROOM)
                .map(ConnectionEndpoint::id)
                .filter(Objects::nonNull)
                .anyMatch(affectedRoomIds::contains);
    }

    private static DungeonConnection reboundTransitionLocalConnection(
            DungeonMap layout,
            DungeonTransition transition,
            Set<Long> affectedRoomIds,
            boolean requirePersistedRoomId
    ) {
        if (layout == null
                || transition == null
                || transition.localConnection() == null
                || affectedRoomIds == null
                || affectedRoomIds.isEmpty()) {
            return transition == null ? null : transition.localConnection();
        }
        DungeonConnection localConnection = transition.localConnection();
        if (localConnection.doorCarrier() != null) {
            ConnectionEndpoint entryEndpoint = localConnection.entryEndpoint();
            if (entryEndpoint == null
                    || entryEndpoint.type() != features.world.dungeon.model.structures.connection.ConnectionEndpointType.ROOM
                    || !affectedRoomIds.contains(entryEndpoint.id())) {
                return localConnection;
            }
            Room reboundRoom = resolveTransitionDoorRoom(
                    layout,
                    localConnection.levelZ(),
                    localConnection.doorRef(),
                    requirePersistedRoomId);
            DungeonMap.DoorDescription reboundDoor = layout.describeDoor(localConnection.doorRef());
            if (reboundDoor == null) {
                throw new IllegalArgumentException("Transition door no longer resolves to a canonical door");
            }
            return new DungeonConnection(
                    localConnection.kind(),
                    localConnection.ownerId(),
                    localConnection.mapId(),
                    localConnection.levelZ(),
                    new DoorConnectionCarrier(reboundDoor.ref()),
                    List.of(ConnectionEndpoint.room(reboundRoom.roomId()), ConnectionEndpoint.transition(transition.transitionId())));
        }
        if (localConnection.stairCarrier() != null) {
            ConnectionEndpoint entryEndpoint = localConnection.entryEndpoint();
            if (entryEndpoint == null
                    || entryEndpoint.type() != features.world.dungeon.model.structures.connection.ConnectionEndpointType.ROOM
                    || !affectedRoomIds.contains(entryEndpoint.id())) {
                return localConnection;
            }
            StairConnectionCarrier stairCarrier = localConnection.stairCarrier();
            Room reboundRoom = roomWithFloorAtCell(layout, stairCarrier.anchorCell(), stairCarrier.anchorLevelZ());
            if (reboundRoom == null) {
                throw new IllegalArgumentException("Transition stair anchor no longer resolves to a room floor");
            }
            if (requirePersistedRoomId && reboundRoom.roomId() == null) {
                throw new IllegalArgumentException("Transition stair rebound requires a persisted room id");
            }
            return new DungeonConnection(
                    localConnection.kind(),
                    localConnection.ownerId(),
                    localConnection.mapId(),
                    localConnection.levelZ(),
                    new StairConnectionCarrier(
                            stairCarrier.anchorCell(),
                            stairCarrier.anchorLevelZ(),
                            stairCarrier.stair()),
                    List.of(ConnectionEndpoint.room(reboundRoom.roomId()), ConnectionEndpoint.transition(transition.transitionId())));
        }
        return localConnection;
    }

    private static Room resolveTransitionDoorRoom(
            DungeonMap layout,
            int levelZ,
            DoorRef doorRef,
            boolean requirePersistedRoomId
    ) {
        if (layout == null || doorRef == null) {
            throw new IllegalArgumentException("Transition door rebound requires a canonical door");
        }
        DungeonMap.DoorDescription reboundDoor = layout.describeDoor(doorRef);
        if (reboundDoor == null || reboundDoor.levelZ() != levelZ || reboundDoor.role() != DungeonMap.DoorRole.ROOM_EXTERIOR) {
            throw new IllegalArgumentException("Transition door no longer resolves to an exterior room boundary");
        }
        Room reboundRoom = reboundDoor.touchingRooms().isEmpty() ? null : reboundDoor.touchingRooms().getFirst();
        if (reboundRoom == null) {
            throw new IllegalArgumentException("Transition door no longer resolves to an exterior room boundary");
        }
        if (requirePersistedRoomId && reboundRoom.roomId() == null) {
            throw new IllegalArgumentException("Transition door rebound requires a persisted room id");
        }
        return reboundRoom;
    }

    private static Set<Long> affectedRoomIds(List<Cluster> clusters) {
        LinkedHashSet<Long> result = new LinkedHashSet<>();
        for (Cluster cluster : clusters == null ? List.<Cluster>of() : clusters) {
            if (cluster == null) {
                continue;
            }
            for (Room room : cluster.roomTopology().rooms()) {
                if (room != null && room.roomId() != null) {
                    result.add(room.roomId());
                }
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static List<Cluster> normalizedClusters(List<Cluster> clusters) {
        if (clusters == null || clusters.isEmpty()) {
            return List.of();
        }
        List<Cluster> result = new java.util.ArrayList<>();
        LinkedHashSet<Long> seenClusterIds = new LinkedHashSet<>();
        for (Cluster cluster : clusters) {
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

    private static Set<Long> roomIds(List<Cluster> clusters) {
        LinkedHashSet<Long> result = new LinkedHashSet<>();
        for (Cluster cluster : clusters == null ? List.<Cluster>of() : clusters) {
            if (cluster == null) {
                continue;
            }
            for (Room room : cluster.roomTopology().rooms()) {
                if (room != null && room.roomId() != null) {
                    result.add(room.roomId());
                }
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static Set<GridPoint> intersect(Set<GridPoint> left, Set<GridPoint> right) {
        if (left == null || left.isEmpty() || right == null || right.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<GridPoint> result = new LinkedHashSet<>();
        for (GridPoint cell : left) {
            if (right.contains(cell)) {
                result.add(cell);
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static void validateFloorDelete(
            DungeonMap layout,
            Room room,
            int levelZ,
            Set<GridPoint> removedFloorCells
    ) throws SQLException {
        if (layout == null || room == null || room.roomId() == null || removedFloorCells == null || removedFloorCells.isEmpty()) {
            return;
        }
        for (Corridor corridor : layout.corridors()) {
            if (corridor == null || corridor.levelZ() != levelZ) {
                continue;
            }
            for (CorridorNode node : corridor.nodes()) {
                DungeonMap.DoorDescription description = node == null || !node.isDoorBound()
                        ? null
                        : layout.describeDoor(node.doorRef());
                if (node != null
                        && description != null
                        && description.isRoomExterior()
                        && Objects.equals(description.roomId(), room.roomId())
                        && description.anchorSegment().cellFootprint().cells().stream().anyMatch(removedFloorCells::contains)) {
                    throw new SQLException("Boden unter einem Corridor-Anker kann nicht entfernt werden.");
                }
            }
        }
        for (DungeonTransition transition : layout.transitionsAtLevel(levelZ)) {
            if (transition != null
                    && transition.transitionId() != null
                    && transition.localConnection() != null
                    && transition.localConnection().cellFootprint(layout).cells().stream()
                    .filter(point -> point != null && point.z() == levelZ)
                    .anyMatch(removedFloorCells::contains)) {
                throw new SQLException("Boden unter einem platzierten Übergang kann nicht entfernt werden.");
            }
        }
        for (DungeonStair stair : layout.stairsAtLevel(levelZ)) {
            if (stair == null || stair.stairId() == null) {
                continue;
            }
            boolean usesRemovedExit = stair.exitsAtLevel(levelZ).stream()
                    .map(StairExit::cell)
                    .filter(Objects::nonNull)
                    .anyMatch(removedFloorCells::contains);
            if (usesRemovedExit) {
                throw new SQLException("Boden unter einem Treppenanschluss kann nicht entfernt werden.");
            }
        }
    }

    private static List<Room> rooms(DungeonMap layout) {
        if (layout == null) {
            return List.of();
        }
        return layout.clusters().stream()
                .flatMap(cluster -> cluster.roomTopology().rooms().stream())
                .toList();
    }

    private static Structure roomStructure(DungeonMap layout, Room room) {
        if (layout == null || room == null) {
            return Structure.empty();
        }
        Cluster cluster = layout.findCluster(room.clusterId());
        return cluster == null ? Structure.empty() : cluster.roomTopology().structureFor(room);
    }

    private static Room roomAtCell(DungeonMap layout, GridPoint cell, int levelZ) {
        Cluster cluster = layout == null ? null : layout.clusterAtCell(cell, levelZ);
        return cluster == null ? null : cluster.roomTopology().roomAt(cell, levelZ);
    }

    private static Room roomWithFloorAtCell(DungeonMap layout, GridPoint cell, int levelZ) {
        Room room = roomAtCell(layout, cell, levelZ);
        return room != null && roomStructure(layout, room).surfaceAtLevel(levelZ).floor().contains(cell) ? room : null;
    }

    public record MoveDoorRequest(
            long mapId,
            long clusterId,
            int levelZ,
            GridSegment sourceBoundarySegment,
            GridSegment targetBoundarySegment
    ) {
    }
}
