package features.world.dungeon.dungeonmap.cluster.application;

import database.DatabaseManager;
import features.world.dungeon.application.support.DungeonTransactionRunner;
import features.world.dungeon.dungeonmap.api.AssertClusterFloorDeletionAllowedRequest;
import features.world.dungeon.dungeonmap.api.ReconcileClusterRewriteRequest;
import features.world.dungeon.dungeonmap.api.ValidateClusterRewriteRequest;
import features.world.dungeon.dungeonmap.application.DungeonMapApplicationService;
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
 * <p>Public callers enter through a small set of workflow request families so tools and neighboring
 * application flows do not mirror cluster rewrite plumbing or internal mutation details.
 */
public final class DungeonClusterApplicationService {

    private final DungeonMapApplicationService mapApplicationService;
    private final DungeonMapRepository mapRepository;
    private final DungeonClusterRepository clusterRepository;
    private final DungeonCorridorRepository corridorRepository;
    private final DungeonRoomRepository roomRepository;
    private final DungeonTransitionRepository transitionRepository;

    public DungeonClusterApplicationService(
            DungeonMapApplicationService mapApplicationService,
            DungeonMapRepository mapRepository,
            DungeonClusterRepository clusterRepository,
            DungeonCorridorRepository corridorRepository,
            DungeonRoomRepository roomRepository,
            DungeonTransitionRepository transitionRepository
    ) {
        this.mapApplicationService = Objects.requireNonNull(mapApplicationService, "mapApplicationService");
        this.mapRepository = Objects.requireNonNull(mapRepository, "mapRepository");
        this.clusterRepository = Objects.requireNonNull(clusterRepository, "clusterRepository");
        this.corridorRepository = Objects.requireNonNull(corridorRepository, "corridorRepository");
        this.roomRepository = Objects.requireNonNull(roomRepository, "roomRepository");
        this.transitionRepository = Objects.requireNonNull(transitionRepository, "transitionRepository");
    }

    public void rewriteSurface(ClusterSurfaceRewriteRequest request) throws SQLException {
        ClusterSurfaceRewriteRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.mapId() <= 0) {
            throw new IllegalArgumentException("Cluster surface rewrite requires mapId");
        }
        GridArea resolvedCells = resolvedRequest.cells() == null ? GridArea.empty() : resolvedRequest.cells().onLevel(resolvedRequest.levelZ());
        if (resolvedCells.isEmpty()) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                rewriteSurface(conn, resolvedRequest.mapId(), resolvedRequest.levelZ(), resolvedCells, resolvedRequest.mode());
                return null;
            });
        }
    }

    public void editFloor(ClusterFloorEditRequest request) throws SQLException {
        ClusterFloorEditRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.mapId() <= 0) {
            throw new IllegalArgumentException("Cluster floor edit requires mapId");
        }
        GridArea resolvedCells = resolvedRequest.cells() == null ? GridArea.empty() : resolvedRequest.cells().onLevel(resolvedRequest.levelZ());
        if (resolvedCells.isEmpty()) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                applyFloorEdit(
                        conn,
                        resolvedRequest.mapId(),
                        resolvedRequest.levelZ(),
                        resolvedCells,
                        resolvedRequest.mode() == ClusterFloorEditMode.REMOVE);
                return null;
            });
        }
    }

    private void applyFloorEdit(
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
                    mapApplicationService.assertClusterFloorDeletionAllowed(new AssertClusterFloorDeletionAllowedRequest(
                            workingLayout,
                            room,
                            levelZ,
                            GridArea.of(removedFloorCells)));
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

    public void editBoundary(ClusterBoundaryEditRequest request) throws SQLException {
        ClusterBoundaryEditRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.mapId() <= 0 || resolvedRequest.clusterId() <= 0) {
            throw new IllegalArgumentException("Cluster boundary edit requires mapId and clusterId");
        }
        GridBoundary resolvedSegments = resolvedRequest.segments() == null ? GridBoundary.empty() : resolvedRequest.segments();
        if (resolvedSegments.isEmpty()) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                editBoundary(
                        conn,
                        resolvedRequest.mapId(),
                        resolvedRequest.clusterId(),
                        resolvedRequest.levelZ(),
                        resolvedSegments,
                        resolvedRequest.mode(),
                        resolvedRequest.target());
                return null;
            });
        }
    }

    public void moveDoor(ClusterDoorMoveRequest request) throws SQLException {
        ClusterDoorMoveRequest resolvedRequest = Objects.requireNonNull(request, "request");
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

    private void rewriteSurface(
            Connection conn,
            long mapId,
            int levelZ,
            GridArea cells,
            ClusterSurfaceRewriteMode mode
    ) throws SQLException {
        if (mode == ClusterSurfaceRewriteMode.DELETE) {
            rewriteDeletedSurface(conn, mapId, levelZ, cells);
            return;
        }
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

    private void rewriteDeletedSurface(Connection conn, long mapId, int levelZ, GridArea cells) throws SQLException {
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

    public void bootstrapDefaultCluster(Connection conn, ClusterBootstrapRequest request) throws SQLException {
        ClusterBootstrapRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.mapId() <= 0) {
            throw new IllegalArgumentException("Cluster bootstrap requires mapId");
        }
        createClusterWithRoom(
                conn,
                resolvedRequest.mapId(),
                resolvedRequest.levelZ(),
                resolvedRequest.cells(),
                resolvedRequest.roomName());
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

    public void moveCluster(ClusterMoveRequest request) throws SQLException {
        ClusterMoveRequest resolvedRequest = Objects.requireNonNull(request, "request");
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

    private void ensureTraversableCell(Connection conn, long mapId, GridPoint cell, int levelZ) throws SQLException {
        if (cell == null) {
            return;
        }
        DungeonMap layout = requireLayout(conn, mapId);
        if (layout.isTraversableCell(cell, levelZ)) {
            return;
        }
        Room room = roomAtCell(layout, cell, levelZ);
        if (room != null) {
            applyFloorEdit(conn, mapId, levelZ, GridArea.of(Set.of(cell)), false);
            return;
        }
        rewriteSurface(conn, mapId, levelZ, GridArea.of(Set.of(cell)), ClusterSurfaceRewriteMode.PAINT);
    }

    private void editBoundary(
            Connection conn,
            long mapId,
            long clusterId,
            int levelZ,
            GridBoundary segments,
            ClusterBoundaryEditMode mode,
            ClusterBoundaryTarget target
    ) throws SQLException {
        if (segments == null || segments.isEmpty()) {
            return;
        }
        DungeonMap layout = requireLayout(conn, mapId);
        Cluster cluster = layout.findCluster(clusterId);
        if (cluster == null) {
            return;
        }
        Cluster updatedCluster = switch (target) {
            case WALL -> cluster.mutated(new ClusterMutationRequest.WallPathEdit(
                    levelZ,
                    segments,
                    mode == ClusterBoundaryEditMode.DELETE
                            ? ClusterMutationRequest.BoundaryEditMode.DELETE
                            : ClusterMutationRequest.BoundaryEditMode.CREATE));
            case INTERIOR_DOOR -> cluster.mutated(new ClusterMutationRequest.DoorSegmentsEdit(
                    levelZ,
                    segments,
                    mode == ClusterBoundaryEditMode.DELETE
                            ? ClusterMutationRequest.BoundaryEditMode.DELETE
                            : ClusterMutationRequest.BoundaryEditMode.CREATE,
                    ClusterMutationRequest.DoorScope.INTERIOR));
            case EXTERIOR_DOOR -> cluster.mutated(new ClusterMutationRequest.DoorSegmentsEdit(
                    levelZ,
                    segments,
                    mode == ClusterBoundaryEditMode.DELETE
                            ? ClusterMutationRequest.BoundaryEditMode.DELETE
                            : ClusterMutationRequest.BoundaryEditMode.CREATE,
                    ClusterMutationRequest.DoorScope.EXTERIOR));
        };
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
        mapApplicationService.validateClusterRewrite(new ValidateClusterRewriteRequest(originalLayout, rewriteRequest));
        clusterRepository.replaceClusters(conn, mapId, rewriteRequest);
        if (!rewriteRequest.hasAffectedRooms()) {
            return;
        }
        DungeonMap persistedRoomLayout = loadRoomRewriteLayout(conn, originalLayout, mapId);
        var rewriteEffects = mapApplicationService.reconcileClusterRewrite(
                new ReconcileClusterRewriteRequest(originalLayout, persistedRoomLayout, rewriteRequest));
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

    public record ClusterSurfaceRewriteRequest(
            long mapId,
            int levelZ,
            GridArea cells,
            ClusterSurfaceRewriteMode mode
    ) {
        public ClusterSurfaceRewriteRequest {
            cells = cells == null ? GridArea.empty() : cells.onLevel(levelZ);
            mode = mode == null ? ClusterSurfaceRewriteMode.PAINT : mode;
        }
    }

    public record ClusterFloorEditRequest(
            long mapId,
            int levelZ,
            GridArea cells,
            ClusterFloorEditMode mode
    ) {
        public ClusterFloorEditRequest {
            cells = cells == null ? GridArea.empty() : cells.onLevel(levelZ);
            mode = mode == null ? ClusterFloorEditMode.ADD : mode;
        }
    }

    public record ClusterBoundaryEditRequest(
            long mapId,
            long clusterId,
            int levelZ,
            GridBoundary segments,
            ClusterBoundaryTarget target,
            ClusterBoundaryEditMode mode
    ) {
        public ClusterBoundaryEditRequest {
            segments = segments == null ? GridBoundary.empty() : segments;
            target = target == null ? ClusterBoundaryTarget.WALL : target;
            mode = mode == null ? ClusterBoundaryEditMode.CREATE : mode;
        }
    }

    public record ClusterMoveRequest(
            long mapId,
            long clusterId,
            GridTranslation translation
    ) {
        public ClusterMoveRequest {
            translation = translation == null ? GridTranslation.none() : translation;
        }
    }

    public record ClusterDoorMoveRequest(
            long mapId,
            long clusterId,
            int levelZ,
            GridSegment sourceBoundarySegment,
            GridSegment targetBoundarySegment
    ) {
    }

    public record ClusterBootstrapRequest(
            long mapId,
            int levelZ,
            GridArea cells,
            String roomName
    ) {
        public ClusterBootstrapRequest(long mapId) {
            this(mapId, 0, GridPoint.cell(0, 0, 0).cellFootprint(), "Raum 1");
        }

        public ClusterBootstrapRequest {
            cells = cells == null ? GridArea.empty() : cells.onLevel(levelZ);
            roomName = roomName == null || roomName.isBlank() ? "Raum 1" : roomName;
        }
    }

    public enum ClusterSurfaceRewriteMode {
        PAINT,
        DELETE
    }

    public enum ClusterFloorEditMode {
        ADD,
        REMOVE
    }

    public enum ClusterBoundaryTarget {
        WALL,
        INTERIOR_DOOR,
        EXTERIOR_DOOR
    }

    public enum ClusterBoundaryEditMode {
        CREATE,
        DELETE
    }
}
