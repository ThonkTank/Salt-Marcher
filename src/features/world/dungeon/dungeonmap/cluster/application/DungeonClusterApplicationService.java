package features.world.dungeon.dungeonmap.cluster.application;

import database.DatabaseManager;
import features.world.dungeon.application.support.DungeonTransactionRunner;
import features.world.dungeon.dungeonmap.cluster.model.ClusterDeleteRequest;
import features.world.dungeon.dungeonmap.cluster.model.ClusterMutationRequest;
import features.world.dungeon.dungeonmap.cluster.model.ClusterPaintRequest;
import features.world.dungeon.dungeonmap.cluster.model.ClusterRewriteRequest;
import features.world.dungeon.dungeonmap.cluster.model.Cluster;
import features.world.dungeon.dungeonmap.cluster.repository.DungeonClusterRepository;
import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridSegment;
import features.world.dungeon.geometry.GridArea;
import features.world.dungeon.geometry.GridBoundary;
import features.world.dungeon.geometry.GridTranslation;
import features.world.dungeon.dungeonmap.structure.model.Structure;
import features.world.dungeon.dungeonmap.structure.model.StructureSpecification;
import features.world.dungeon.dungeonmap.structure.model.surface.StructureSurface;
import features.world.dungeon.dungeonmap.corridor.model.Corridor;
import features.world.dungeon.model.structures.room.Room;
import features.world.dungeon.model.structures.transition.DungeonTransition;
import features.world.dungeon.dungeonmap.corridor.repository.DungeonCorridorRepository;
import features.world.dungeon.dungeonmap.repository.DungeonMapRepository;
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

    public void paintCells(PaintCellsRequest request) throws SQLException {
        PaintCellsRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.mapId() <= 0) {
            throw new IllegalArgumentException("Cluster paint requires mapId");
        }
        GridArea resolvedCells = resolvedRequest.cells() == null ? GridArea.empty() : resolvedRequest.cells().onLevel(resolvedRequest.levelZ());
        if (resolvedCells.isEmpty()) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                paintCells(conn, resolvedRequest.mapId(), resolvedRequest.levelZ(), resolvedCells);
                return null;
            });
        }
    }

    public void deleteCells(DeleteCellsRequest request) throws SQLException {
        DeleteCellsRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.mapId() <= 0) {
            throw new IllegalArgumentException("Cluster delete requires mapId");
        }
        GridArea resolvedCells = resolvedRequest.cells() == null ? GridArea.empty() : resolvedRequest.cells().onLevel(resolvedRequest.levelZ());
        if (resolvedCells.isEmpty()) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                deleteCells(conn, resolvedRequest.mapId(), resolvedRequest.levelZ(), resolvedCells);
                return null;
            });
        }
    }

    public void addFloorCells(AddFloorCellsRequest request) throws SQLException {
        AddFloorCellsRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.mapId() <= 0) {
            throw new IllegalArgumentException("Cluster floor add requires mapId");
        }
        GridArea resolvedCells = resolvedRequest.cells() == null ? GridArea.empty() : resolvedRequest.cells().onLevel(resolvedRequest.levelZ());
        if (resolvedCells.isEmpty()) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                editFloorCells(conn, resolvedRequest.mapId(), resolvedRequest.levelZ(), resolvedCells, false);
                return null;
            });
        }
    }

    public void deleteFloorCells(DeleteFloorCellsRequest request) throws SQLException {
        DeleteFloorCellsRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.mapId() <= 0) {
            throw new IllegalArgumentException("Cluster floor delete requires mapId");
        }
        GridArea resolvedCells = resolvedRequest.cells() == null ? GridArea.empty() : resolvedRequest.cells().onLevel(resolvedRequest.levelZ());
        if (resolvedCells.isEmpty()) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                editFloorCells(conn, resolvedRequest.mapId(), resolvedRequest.levelZ(), resolvedCells, true);
                return null;
            });
        }
    }

    public void createWallPath(CreateWallPathRequest request) throws SQLException {
        CreateWallPathRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.mapId() <= 0 || resolvedRequest.clusterId() <= 0) {
            throw new IllegalArgumentException("Wall creation requires mapId and clusterId");
        }
        GridBoundary resolvedSegments = resolvedRequest.segments() == null ? GridBoundary.empty() : resolvedRequest.segments();
        if (resolvedSegments.isEmpty()) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                createWallPath(conn, resolvedRequest.mapId(), resolvedRequest.clusterId(), resolvedRequest.levelZ(), resolvedSegments);
                return null;
            });
        }
    }

    public void deleteWallPath(DeleteWallPathRequest request) throws SQLException {
        DeleteWallPathRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.mapId() <= 0 || resolvedRequest.clusterId() <= 0) {
            throw new IllegalArgumentException("Wall deletion requires mapId and clusterId");
        }
        GridBoundary resolvedSegments = resolvedRequest.segments() == null ? GridBoundary.empty() : resolvedRequest.segments();
        if (resolvedSegments.isEmpty()) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                deleteWallPath(conn, resolvedRequest.mapId(), resolvedRequest.clusterId(), resolvedRequest.levelZ(), resolvedSegments);
                return null;
            });
        }
    }

    public void createDoor(CreateDoorRequest request) throws SQLException {
        CreateDoorRequest resolvedRequest = Objects.requireNonNull(request, "request");
        editDoor(
                resolvedRequest.mapId(),
                resolvedRequest.clusterId(),
                resolvedRequest.levelZ(),
                resolvedRequest.segments(),
                false,
                ClusterMutationRequest.DoorScope.INTERIOR);
    }

    public void deleteDoor(DeleteDoorRequest request) throws SQLException {
        DeleteDoorRequest resolvedRequest = Objects.requireNonNull(request, "request");
        editDoor(
                resolvedRequest.mapId(),
                resolvedRequest.clusterId(),
                resolvedRequest.levelZ(),
                resolvedRequest.segments(),
                true,
                ClusterMutationRequest.DoorScope.INTERIOR);
    }

    public void createExteriorDoor(CreateExteriorDoorRequest request) throws SQLException {
        CreateExteriorDoorRequest resolvedRequest = Objects.requireNonNull(request, "request");
        editDoor(
                resolvedRequest.mapId(),
                resolvedRequest.clusterId(),
                resolvedRequest.levelZ(),
                resolvedRequest.segments(),
                false,
                ClusterMutationRequest.DoorScope.EXTERIOR);
    }

    public void deleteExteriorDoor(DeleteExteriorDoorRequest request) throws SQLException {
        DeleteExteriorDoorRequest resolvedRequest = Objects.requireNonNull(request, "request");
        editDoor(
                resolvedRequest.mapId(),
                resolvedRequest.clusterId(),
                resolvedRequest.levelZ(),
                resolvedRequest.segments(),
                true,
                ClusterMutationRequest.DoorScope.EXTERIOR);
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
                Cluster updatedCluster = cluster.mutated(new ClusterMutationRequest.DoorMove(
                        resolvedRequest.levelZ(),
                        resolvedRequest.sourceBoundarySegment(),
                        resolvedRequest.targetBoundarySegment()));
                if (updatedCluster != cluster) {
                    persistClusterRewrite(
                            conn,
                            resolvedRequest.mapId(),
                            layout,
                            ClusterRewriteRequest.of(List.of(cluster), List.of(updatedCluster)));
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
            createClusterWithRoom(conn, mapId, levelZ, cells, nextRoomName(layout, new LinkedHashSet<>()));
            return;
        }

        ClusterRewriteRequest rewriteRequest = overlappingClusters.getFirst().rewritePaint(new ClusterPaintRequest(
                cells,
                overlappingClusters,
                levelZ));
        if (rewriteRequest == null || !rewriteRequest.hasChanges()) {
            return;
        }

        persistClusterRewrite(conn, mapId, layout, rewriteRequest);
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
            ClusterRewriteRequest rewriteRequest = cluster.rewriteDelete(new ClusterDeleteRequest(
                    cells,
                    levelZ,
                    () -> nextRoomName(layoutSnapshot, reservedNames)));
            if (rewriteRequest == null || !rewriteRequest.hasChanges()) {
                continue;
            }
            persistClusterRewrite(conn, mapId, workingLayout, rewriteRequest);
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
                    roomStructure.surfaceAtLevel(levelZ).surface().cellFootprint().cells(),
                    requestedCells);
            if (requestedRoomCells.isEmpty()) {
                continue;
            }
            if (deleteFloor) {
                Set<GridPoint> removedFloorCells = intersect(
                        roomStructure.surfaceAtLevel(levelZ).floor().cellFootprint().cells(),
                        requestedRoomCells);
                if (removedFloorCells.isEmpty()) {
                    continue;
                }
                try {
                    workingLayout.assertClusterFloorDeletionAllowed(room, levelZ, GridArea.of(removedFloorCells));
                } catch (IllegalArgumentException exception) {
                    throw new SQLException(exception.getMessage(), exception);
                }
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
            Set<GridPoint> currentFloorCells = new LinkedHashSet<>(structureSurface.floor().cellFootprint().cells());
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
            Cluster updatedCluster = cluster.mutated(new ClusterMutationRequest.FloorCellsEdit(
                    levelZ,
                    GridArea.of(clusterRequestedCells),
                    deleteFloor ? ClusterMutationRequest.CellEditMode.REMOVE : ClusterMutationRequest.CellEditMode.ADD));
            persistClusterRewrite(conn, mapId, workingLayout, ClusterRewriteRequest.of(List.of(cluster), List.of(updatedCluster)));
            workingLayout = requireLayout(conn, mapId);
        }
    }

    public void createDefaultRoom(Connection conn, long mapId) throws SQLException {
        // Brand-new dungeons must bootstrap their first room without rehydrating an empty layout first.
        createClusterWithRoom(conn, mapId, 0, GridPoint.cell(0, 0, 0).cellFootprint(), "Raum 1");
    }

    private void createClusterWithRoom(
            Connection conn,
            long mapId,
            int levelZ,
            GridArea area,
            String roomName
    ) throws SQLException {
        GridArea resolvedArea = area == null ? GridArea.empty() : area.onLevel(levelZ);
        if (resolvedArea.isEmpty()) {
            return;
        }
        GridPoint center = resolvedArea.center();
        Structure structure = Structure.fromSpecification(StructureSpecification.ofLevel(
                levelZ,
                new StructureSpecification.LevelSpecification(
                        center,
                        resolvedArea,
                        resolvedArea,
                        List.of(),
                        List.of())));
        DungeonClusterRepository.PersistedCluster persistedCluster =
                clusterRepository.createCluster(conn, mapId, structure);
        roomRepository.saveRooms(conn, mapId, persistedCluster.clusterId(), List.of(
                new Room(null, mapId, persistedCluster.clusterId(), roomName, java.util.Map.of(levelZ, center), null)));
    }

    public void move(MoveClusterRequest request) throws SQLException {
        MoveClusterRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.mapId() <= 0 || resolvedRequest.clusterId() <= 0) {
            throw new IllegalArgumentException("Cluster move requires mapId and clusterId");
        }
        GridTranslation resolvedTranslation = resolvedRequest.translation() == null
                ? GridTranslation.none()
                : resolvedRequest.translation();
        if (resolvedTranslation.isZero()) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonMap layout = requireLayout(conn, resolvedRequest.mapId());
                Cluster cluster = requireCluster(layout, resolvedRequest.clusterId());
                ClusterRewriteRequest rewriteRequest = ClusterRewriteRequest.of(
                        List.of(cluster),
                        List.of(cluster.mutated(new ClusterMutationRequest.Translation(resolvedTranslation))),
                        resolvedTranslation);
                persistClusterRewrite(conn, resolvedRequest.mapId(), layout, rewriteRequest);
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
        Cluster updatedCluster = cluster.mutated(new ClusterMutationRequest.WallPathEdit(
                levelZ,
                segments,
                ClusterMutationRequest.BoundaryEditMode.CREATE));
        if (updatedCluster == cluster) {
            return;
        }

        persistClusterRewrite(conn, mapId, layout, ClusterRewriteRequest.of(List.of(cluster), List.of(updatedCluster)));
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
        Cluster updatedCluster = cluster.mutated(new ClusterMutationRequest.WallPathEdit(
                levelZ,
                segments,
                ClusterMutationRequest.BoundaryEditMode.DELETE));
        if (updatedCluster == cluster) {
            return;
        }

        persistClusterRewrite(conn, mapId, layout, ClusterRewriteRequest.of(List.of(cluster), List.of(updatedCluster)));
    }

    private void editDoor(
            long mapId,
            long clusterId,
            int levelZ,
            GridBoundary segments,
            boolean deleteDoor,
            ClusterMutationRequest.DoorScope scope
    ) throws SQLException {
        if (mapId <= 0 || clusterId <= 0) {
            throw new IllegalArgumentException("Door edit requires mapId and clusterId");
        }
        if (segments == null || segments.isEmpty()) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                editDoor(conn, mapId, clusterId, levelZ, segments, deleteDoor, scope);
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
            boolean deleteDoor,
            ClusterMutationRequest.DoorScope scope
    ) throws SQLException {
        DungeonMap layout = requireLayout(conn, mapId);
        Cluster cluster = layout.findCluster(clusterId);
        if (cluster == null) {
            return;
        }
        Cluster updatedCluster = cluster.mutated(new ClusterMutationRequest.DoorSegmentsEdit(
                levelZ,
                segments,
                deleteDoor ? ClusterMutationRequest.BoundaryEditMode.DELETE : ClusterMutationRequest.BoundaryEditMode.CREATE,
                scope));
        if (updatedCluster == cluster) {
            return;
        }
        persistClusterRewrite(conn, mapId, layout, ClusterRewriteRequest.of(List.of(cluster), List.of(updatedCluster)));
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
                        && !intersect(roomStructure(layout, room).surfaceAtLevel(levelZ).surface().cellFootprint().cells(), cells).isEmpty())
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
            ClusterRewriteRequest rewriteRequest
    ) throws SQLException {
        if (conn == null || originalLayout == null || rewriteRequest == null || !rewriteRequest.hasChanges()) {
            return;
        }
        originalLayout.validateClusterRewrite(rewriteRequest);
        clusterRepository.replaceClusters(conn, mapId, rewriteRequest);
        if (!rewriteRequest.hasAffectedRooms()) {
            return;
        }
        DungeonMap persistedRoomLayout = loadRoomRewriteLayout(conn, originalLayout, mapId);
        var rewriteEffects = originalLayout.reconcileClusterRewrite(persistedRoomLayout, rewriteRequest);
        for (Corridor reboundCorridor : rewriteEffects.reboundCorridors()) {
            if (reboundCorridor != null) {
                corridorRepository.save(conn, reboundCorridor, persistedRoomLayout.mapId());
            }
        }
        for (Map.Entry<Long, features.world.dungeon.model.structures.connection.DungeonConnection> entry
                : rewriteEffects.reboundTransitionConnectionsById().entrySet()) {
            if (entry.getKey() == null) {
                continue;
            }
            DungeonTransition transition = originalLayout.findTransition(entry.getKey());
            transitionRepository.updateLocalConnection(
                    conn,
                    entry.getKey(),
                    entry.getValue(),
                    transition == null ? null : transition.stairPlacementSpec());
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

    public record PaintCellsRequest(
            long mapId,
            int levelZ,
            GridArea cells
    ) {
        public PaintCellsRequest {
            cells = cells == null ? GridArea.empty() : cells.onLevel(levelZ);
        }
    }

    public record DeleteCellsRequest(
            long mapId,
            int levelZ,
            GridArea cells
    ) {
        public DeleteCellsRequest {
            cells = cells == null ? GridArea.empty() : cells.onLevel(levelZ);
        }
    }

    public record AddFloorCellsRequest(
            long mapId,
            int levelZ,
            GridArea cells
    ) {
        public AddFloorCellsRequest {
            cells = cells == null ? GridArea.empty() : cells.onLevel(levelZ);
        }
    }

    public record DeleteFloorCellsRequest(
            long mapId,
            int levelZ,
            GridArea cells
    ) {
        public DeleteFloorCellsRequest {
            cells = cells == null ? GridArea.empty() : cells.onLevel(levelZ);
        }
    }

    public record CreateWallPathRequest(
            long mapId,
            long clusterId,
            int levelZ,
            GridBoundary segments
    ) {
        public CreateWallPathRequest {
            segments = segments == null ? GridBoundary.empty() : segments;
        }
    }

    public record DeleteWallPathRequest(
            long mapId,
            long clusterId,
            int levelZ,
            GridBoundary segments
    ) {
        public DeleteWallPathRequest {
            segments = segments == null ? GridBoundary.empty() : segments;
        }
    }

    public record CreateDoorRequest(
            long mapId,
            long clusterId,
            int levelZ,
            GridBoundary segments
    ) {
        public CreateDoorRequest {
            segments = segments == null ? GridBoundary.empty() : segments;
        }
    }

    public record DeleteDoorRequest(
            long mapId,
            long clusterId,
            int levelZ,
            GridBoundary segments
    ) {
        public DeleteDoorRequest {
            segments = segments == null ? GridBoundary.empty() : segments;
        }
    }

    public record CreateExteriorDoorRequest(
            long mapId,
            long clusterId,
            int levelZ,
            GridBoundary segments
    ) {
        public CreateExteriorDoorRequest {
            segments = segments == null ? GridBoundary.empty() : segments;
        }
    }

    public record DeleteExteriorDoorRequest(
            long mapId,
            long clusterId,
            int levelZ,
            GridBoundary segments
    ) {
        public DeleteExteriorDoorRequest {
            segments = segments == null ? GridBoundary.empty() : segments;
        }
    }

    public record MoveClusterRequest(
            long mapId,
            long clusterId,
            GridTranslation translation
    ) {
        public MoveClusterRequest {
            translation = translation == null ? GridTranslation.none() : translation;
        }
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
