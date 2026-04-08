package features.world.dungeon.dungeonmap.cluster.application.state;

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

    private final features.world.dungeon.dungeonmap.application.DungeonMapApplicationService mapApplicationService;
    private final features.world.dungeon.dungeonmap.DungeonMapObject mapObject;
    private final features.world.dungeon.dungeonmap.repository.DungeonMapRepository mapRepository;
    private final features.world.dungeon.dungeonmap.cluster.repository.DungeonClusterRepository clusterRepository;

    public DungeonClusterApplicationService(
            features.world.dungeon.dungeonmap.application.DungeonMapApplicationService mapApplicationService,
            features.world.dungeon.dungeonmap.repository.DungeonMapRepository mapRepository,
            features.world.dungeon.dungeonmap.cluster.repository.DungeonClusterRepository clusterRepository,
            features.world.dungeon.dungeonmap.corridor.repository.DungeonCorridorRepository corridorRepository,
            features.world.dungeon.repository.DungeonTransitionRepository transitionRepository
    ) {
        this.mapApplicationService = Objects.requireNonNull(mapApplicationService, "mapApplicationService");
        this.mapRepository = Objects.requireNonNull(mapRepository, "mapRepository");
        this.mapObject = new features.world.dungeon.dungeonmap.DungeonMapObject(
                mapRepository,
                mapApplicationService,
                new features.world.dungeon.dungeonmap.corridor.CorridorObject(corridorRepository),
                new features.world.dungeon.transition.TransitionObject(transitionRepository));
        this.clusterRepository = Objects.requireNonNull(clusterRepository, "clusterRepository");
    }

    public DungeonClusterApplicationService(
            features.world.dungeon.dungeonmap.application.DungeonMapApplicationService mapApplicationService,
            features.world.dungeon.dungeonmap.repository.DungeonMapRepository mapRepository,
            features.world.dungeon.dungeonmap.cluster.repository.DungeonClusterRepository clusterRepository,
            features.world.dungeon.dungeonmap.corridor.repository.DungeonCorridorRepository corridorRepository,
            features.world.dungeon.repository.DungeonRoomRepository roomRepository,
            features.world.dungeon.repository.DungeonTransitionRepository transitionRepository
    ) {
        this(mapApplicationService, mapRepository, clusterRepository, corridorRepository, transitionRepository);
    }

    public void rewriteSurface(ClusterSurfaceRewriteRequest request) throws SQLException {
        ClusterSurfaceRewriteRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.mapId() <= 0) {
            throw new IllegalArgumentException("Cluster surface rewrite requires mapId");
        }
        features.world.dungeon.geometry.GridArea resolvedCells = resolvedRequest.cells() == null ? features.world.dungeon.geometry.GridArea.empty() : resolvedRequest.cells().onLevel(resolvedRequest.levelZ());
        if (resolvedCells.isEmpty()) {
            return;
        }
        try (Connection conn = database.DatabaseManager.getConnection()) {
            features.world.dungeon.application.support.DungeonTransactionRunner.inTransaction(conn, () -> {
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
        features.world.dungeon.geometry.GridArea resolvedCells = resolvedRequest.cells() == null ? features.world.dungeon.geometry.GridArea.empty() : resolvedRequest.cells().onLevel(resolvedRequest.levelZ());
        if (resolvedCells.isEmpty()) {
            return;
        }
        try (Connection conn = database.DatabaseManager.getConnection()) {
            features.world.dungeon.application.support.DungeonTransactionRunner.inTransaction(conn, () -> {
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
            features.world.dungeon.geometry.GridArea cells,
            boolean deleteFloor
    ) throws SQLException {
        if (cells == null || cells.isEmpty()) {
            return;
        }
        features.world.dungeon.dungeonmap.model.DungeonMap workingLayout = requireLayout(conn, mapId);
        Set<features.world.dungeon.geometry.GridPoint> requestedCells = cells.cells();
        List<features.world.dungeon.model.structures.room.Room> affectedRooms = overlappingRoomsAtLevel(workingLayout, requestedCells, levelZ);
        if (affectedRooms.isEmpty()) {
            return;
        }

        Map<Long, Set<features.world.dungeon.geometry.GridPoint>> requestedByClusterId = new LinkedHashMap<>();
        for (features.world.dungeon.model.structures.room.Room room : affectedRooms) {
            if (room == null || room.roomId() == null) {
                continue;
            }
            features.world.dungeon.dungeonmap.structure.model.Structure roomStructure = roomStructure(workingLayout, room);
            Set<features.world.dungeon.geometry.GridPoint> requestedRoomCells = intersect(
                    roomStructure.surfaceAtLevel(levelZ).surface().cellFootprint().cells(),
                    requestedCells);
            if (requestedRoomCells.isEmpty()) {
                continue;
            }
            if (deleteFloor) {
                Set<features.world.dungeon.geometry.GridPoint> removedFloorCells = intersect(
                        roomStructure.surfaceAtLevel(levelZ).floor().cellFootprint().cells(),
                        requestedRoomCells);
                if (removedFloorCells.isEmpty()) {
                    continue;
                }
                try {
                    mapApplicationService.assertClusterFloorDeletionAllowed(new features.world.dungeon.dungeonmap.api.AssertClusterFloorDeletionAllowedRequest(
                            workingLayout,
                            room,
                            levelZ,
                            features.world.dungeon.geometry.GridArea.of(removedFloorCells)));
                } catch (IllegalArgumentException exception) {
                    throw new SQLException(exception.getMessage(), exception);
                }
            }
            requestedByClusterId.computeIfAbsent(room.clusterId(), ignored -> new LinkedHashSet<>()).addAll(requestedRoomCells);
        }

        for (Long clusterId : requestedByClusterId.keySet().stream().sorted().toList()) {
            features.world.dungeon.dungeonmap.cluster.model.Cluster cluster = workingLayout.findCluster(clusterId);
            if (cluster == null) {
                continue;
            }
            Set<features.world.dungeon.geometry.GridPoint> clusterRequestedCells = requestedByClusterId.getOrDefault(clusterId, Set.of());
            features.world.dungeon.dungeonmap.structure.model.surface.StructureSurface structureSurface = cluster.surfaceAtLevel(levelZ);
            Set<features.world.dungeon.geometry.GridPoint> currentFloorCells = new LinkedHashSet<>(structureSurface.floor().cellFootprint().cells());
            Set<features.world.dungeon.geometry.GridPoint> nextFloorCells = new LinkedHashSet<>(currentFloorCells);
            boolean changed;
            if (deleteFloor) {
                changed = nextFloorCells.removeAll(clusterRequestedCells);
            } else {
                changed = nextFloorCells.addAll(clusterRequestedCells);
            }
            if (!changed) {
                continue;
            }
            features.world.dungeon.dungeonmap.cluster.model.Cluster updatedCluster = cluster.mutated(new features.world.dungeon.dungeonmap.cluster.model.ClusterMutationRequest.FloorCellsEdit(
                    levelZ,
                    features.world.dungeon.geometry.GridArea.of(clusterRequestedCells),
                    deleteFloor ? features.world.dungeon.dungeonmap.cluster.model.ClusterMutationRequest.CellEditMode.REMOVE : features.world.dungeon.dungeonmap.cluster.model.ClusterMutationRequest.CellEditMode.ADD));
            persistClusterRewrite(
                    conn,
                    mapId,
                    workingLayout,
                    features.world.dungeon.dungeonmap.cluster.model.ClusterRewriteRequest.of(List.of(cluster), List.of(updatedCluster)));
            workingLayout = requireLayout(conn, mapId);
        }
    }

    public void editBoundary(ClusterBoundaryEditRequest request) throws SQLException {
        ClusterBoundaryEditRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.mapId() <= 0 || resolvedRequest.clusterId() <= 0) {
            throw new IllegalArgumentException("Cluster boundary edit requires mapId and clusterId");
        }
        features.world.dungeon.geometry.GridBoundary resolvedSegments = resolvedRequest.segments() == null ? features.world.dungeon.geometry.GridBoundary.empty() : resolvedRequest.segments();
        if (resolvedSegments.isEmpty()) {
            return;
        }
        try (Connection conn = database.DatabaseManager.getConnection()) {
            features.world.dungeon.application.support.DungeonTransactionRunner.inTransaction(conn, () -> {
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
        try (Connection conn = database.DatabaseManager.getConnection()) {
            features.world.dungeon.application.support.DungeonTransactionRunner.inTransaction(conn, () -> {
                features.world.dungeon.dungeonmap.model.DungeonMap layout = requireLayout(conn, resolvedRequest.mapId());
                features.world.dungeon.dungeonmap.cluster.model.Cluster cluster = layout.findCluster(resolvedRequest.clusterId());
                if (cluster == null) {
                    return null;
                }
                features.world.dungeon.dungeonmap.cluster.model.Cluster updatedCluster = cluster.mutated(new features.world.dungeon.dungeonmap.cluster.model.ClusterMutationRequest.DoorMove(
                        resolvedRequest.levelZ(),
                        resolvedRequest.sourceBoundarySegment(),
                        resolvedRequest.targetBoundarySegment()));
                if (updatedCluster != cluster) {
                    persistClusterRewrite(
                            conn,
                            resolvedRequest.mapId(),
                            layout,
                            features.world.dungeon.dungeonmap.cluster.model.ClusterRewriteRequest.of(List.of(cluster), List.of(updatedCluster)));
                }
                return null;
            });
        }
    }

    private void rewriteSurface(
            Connection conn,
            long mapId,
            int levelZ,
            features.world.dungeon.geometry.GridArea cells,
            ClusterSurfaceRewriteMode mode
    ) throws SQLException {
        if (mode == ClusterSurfaceRewriteMode.DELETE) {
            rewriteDeletedSurface(conn, mapId, levelZ, cells);
            return;
        }
        features.world.dungeon.dungeonmap.model.DungeonMap layout = requireLayout(conn, mapId);
        Set<features.world.dungeon.geometry.GridPoint> requestedCells = cells.cells();
        List<features.world.dungeon.dungeonmap.cluster.model.Cluster> overlappingClusters =
                overlappingClustersAtLevel(layout, requestedCells, levelZ).stream()
                        .sorted(Comparator.comparing(cluster -> cluster.clusterId() == null ? Long.MAX_VALUE : cluster.clusterId()))
                        .toList();
        if (overlappingClusters.isEmpty()) {
            persistClusterRewrite(
                    conn,
                    mapId,
                    layout,
                    newClusterRewrite(mapId, levelZ, cells, nextRoomName(layout, new LinkedHashSet<>())));
            return;
        }

        features.world.dungeon.dungeonmap.cluster.model.ClusterRewriteRequest rewriteRequest =
                overlappingClusters.getFirst().rewritePaint(new features.world.dungeon.dungeonmap.cluster.model.ClusterPaintRequest(
                        cells,
                        overlappingClusters,
                        levelZ));
        if (rewriteRequest == null || !rewriteRequest.hasChanges()) {
            return;
        }

        persistClusterRewrite(conn, mapId, layout, rewriteRequest);
    }

    private void rewriteDeletedSurface(Connection conn, long mapId, int levelZ, features.world.dungeon.geometry.GridArea cells) throws SQLException {
        features.world.dungeon.dungeonmap.model.DungeonMap workingLayout = requireLayout(conn, mapId);
        Set<String> reservedNames = new LinkedHashSet<>();
        for (features.world.dungeon.model.structures.room.Room room : rooms(workingLayout)) {
            if (room != null && room.name() != null && !room.name().isBlank()) {
                reservedNames.add(room.name());
            }
        }

        List<Long> affectedClusterIds = overlappingClustersAtLevel(workingLayout, cells.cells(), levelZ).stream()
                .map(features.world.dungeon.dungeonmap.cluster.model.Cluster::clusterId)
                .filter(Objects::nonNull)
                .sorted()
                .toList();
        for (Long clusterId : affectedClusterIds) {
            features.world.dungeon.dungeonmap.cluster.model.Cluster cluster = workingLayout.findCluster(clusterId);
            if (cluster == null) {
                continue;
            }
            features.world.dungeon.dungeonmap.model.DungeonMap layoutSnapshot = workingLayout;
            features.world.dungeon.dungeonmap.cluster.model.ClusterRewriteRequest rewriteRequest =
                    cluster.rewriteDelete(new features.world.dungeon.dungeonmap.cluster.model.ClusterDeleteRequest(
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
        persistClusterRewrite(
                conn,
                resolvedRequest.mapId(),
                requireLayout(conn, resolvedRequest.mapId()),
                newClusterRewrite(
                        resolvedRequest.mapId(),
                        resolvedRequest.levelZ(),
                        resolvedRequest.cells(),
                        resolvedRequest.roomName()));
    }

    public void moveCluster(ClusterMoveRequest request) throws SQLException {
        ClusterMoveRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.mapId() <= 0 || resolvedRequest.clusterId() <= 0) {
            throw new IllegalArgumentException("Cluster move requires mapId and clusterId");
        }
        features.world.dungeon.geometry.GridTranslation resolvedTranslation = resolvedRequest.translation() == null
                ? features.world.dungeon.geometry.GridTranslation.none()
                : resolvedRequest.translation();
        if (resolvedTranslation.isZero()) {
            return;
        }
        try (Connection conn = database.DatabaseManager.getConnection()) {
            features.world.dungeon.application.support.DungeonTransactionRunner.inTransaction(conn, () -> {
                features.world.dungeon.dungeonmap.model.DungeonMap layout = requireLayout(conn, resolvedRequest.mapId());
                features.world.dungeon.dungeonmap.cluster.model.Cluster cluster = requireCluster(layout, resolvedRequest.clusterId());
                features.world.dungeon.dungeonmap.cluster.model.ClusterRewriteRequest rewriteRequest =
                        features.world.dungeon.dungeonmap.cluster.model.ClusterRewriteRequest.of(
                                List.of(cluster),
                                List.of(cluster.mutated(new features.world.dungeon.dungeonmap.cluster.model.ClusterMutationRequest.Translation(resolvedTranslation))),
                                resolvedTranslation);
                persistClusterRewrite(conn, resolvedRequest.mapId(), layout, rewriteRequest);
                return null;
            });
        }
    }

    private void ensureTraversableCell(Connection conn, long mapId, features.world.dungeon.geometry.GridPoint cell, int levelZ) throws SQLException {
        if (cell == null) {
            return;
        }
        features.world.dungeon.dungeonmap.model.DungeonMap layout = requireLayout(conn, mapId);
        if (layout.isTraversableCell(cell, levelZ)) {
            return;
        }
        features.world.dungeon.model.structures.room.Room room = roomAtCell(layout, cell, levelZ);
        if (room != null) {
            applyFloorEdit(conn, mapId, levelZ, features.world.dungeon.geometry.GridArea.of(Set.of(cell)), false);
            return;
        }
        rewriteSurface(conn, mapId, levelZ, features.world.dungeon.geometry.GridArea.of(Set.of(cell)), ClusterSurfaceRewriteMode.PAINT);
    }

    private void editBoundary(
            Connection conn,
            long mapId,
            long clusterId,
            int levelZ,
            features.world.dungeon.geometry.GridBoundary segments,
            ClusterBoundaryEditMode mode,
            ClusterBoundaryTarget target
    ) throws SQLException {
        if (segments == null || segments.isEmpty()) {
            return;
        }
        features.world.dungeon.dungeonmap.model.DungeonMap layout = requireLayout(conn, mapId);
        features.world.dungeon.dungeonmap.cluster.model.Cluster cluster = layout.findCluster(clusterId);
        if (cluster == null) {
            return;
        }
        features.world.dungeon.dungeonmap.cluster.model.Cluster updatedCluster = switch (target) {
            case WALL -> cluster.mutated(new features.world.dungeon.dungeonmap.cluster.model.ClusterMutationRequest.WallPathEdit(
                    levelZ,
                    segments,
                    mode == ClusterBoundaryEditMode.DELETE
                            ? features.world.dungeon.dungeonmap.cluster.model.ClusterMutationRequest.BoundaryEditMode.DELETE
                            : features.world.dungeon.dungeonmap.cluster.model.ClusterMutationRequest.BoundaryEditMode.CREATE));
            case INTERIOR_DOOR -> cluster.mutated(new features.world.dungeon.dungeonmap.cluster.model.ClusterMutationRequest.DoorSegmentsEdit(
                    levelZ,
                    segments,
                    mode == ClusterBoundaryEditMode.DELETE
                            ? features.world.dungeon.dungeonmap.cluster.model.ClusterMutationRequest.BoundaryEditMode.DELETE
                            : features.world.dungeon.dungeonmap.cluster.model.ClusterMutationRequest.BoundaryEditMode.CREATE,
                    features.world.dungeon.dungeonmap.cluster.model.ClusterMutationRequest.DoorScope.INTERIOR));
            case EXTERIOR_DOOR -> cluster.mutated(new features.world.dungeon.dungeonmap.cluster.model.ClusterMutationRequest.DoorSegmentsEdit(
                    levelZ,
                    segments,
                    mode == ClusterBoundaryEditMode.DELETE
                            ? features.world.dungeon.dungeonmap.cluster.model.ClusterMutationRequest.BoundaryEditMode.DELETE
                            : features.world.dungeon.dungeonmap.cluster.model.ClusterMutationRequest.BoundaryEditMode.CREATE,
                    features.world.dungeon.dungeonmap.cluster.model.ClusterMutationRequest.DoorScope.EXTERIOR));
        };
        if (updatedCluster == cluster) {
            return;
        }
        persistClusterRewrite(
                conn,
                mapId,
                layout,
                features.world.dungeon.dungeonmap.cluster.model.ClusterRewriteRequest.of(List.of(cluster), List.of(updatedCluster)));
    }

    private static List<features.world.dungeon.dungeonmap.cluster.model.Cluster> overlappingClustersAtLevel(
            features.world.dungeon.dungeonmap.model.DungeonMap layout,
            Set<features.world.dungeon.geometry.GridPoint> cells,
            int levelZ
    ) {
        return layout.overlappingClusters(features.world.dungeon.geometry.GridArea.of(cells)).stream()
                .filter(cluster -> cluster != null && cluster.roomTopology().rooms().stream()
                        .anyMatch(room -> room != null
                                && cluster.roomTopology().roomLevels(room).contains(levelZ)))
                .toList();
    }

    private static List<features.world.dungeon.model.structures.room.Room> overlappingRoomsAtLevel(
            features.world.dungeon.dungeonmap.model.DungeonMap layout,
            Set<features.world.dungeon.geometry.GridPoint> cells,
            int levelZ
    ) {
        if (layout == null || cells == null || cells.isEmpty()) {
            return List.of();
        }
        return rooms(layout).stream()
                .filter(room -> room != null
                        && room.roomId() != null
                        && !intersect(roomStructure(layout, room).surfaceAtLevel(levelZ).surface().cellFootprint().cells(), cells).isEmpty())
                .sorted(Comparator.comparing(features.world.dungeon.model.structures.room.Room::roomId))
                .toList();
    }

    private static String nextRoomName(features.world.dungeon.dungeonmap.model.DungeonMap layout, Set<String> reservedNames) {
        Set<String> used = new LinkedHashSet<>(reservedNames);
        for (features.world.dungeon.model.structures.room.Room room : rooms(layout)) {
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

    private features.world.dungeon.dungeonmap.model.DungeonMap requireLayout(Connection conn, long mapId) throws SQLException {
        features.world.dungeon.dungeonmap.model.DungeonMap layout = mapRepository.loadMap(conn, mapId);
        if (layout == null) {
            throw new SQLException("Dungeon " + mapId + " konnte nicht geladen werden");
        }
        return layout;
    }

    private static features.world.dungeon.dungeonmap.cluster.model.Cluster requireCluster(
            features.world.dungeon.dungeonmap.model.DungeonMap layout,
            long clusterId
    ) throws SQLException {
        features.world.dungeon.dungeonmap.cluster.model.Cluster cluster = layout == null ? null : layout.findCluster(clusterId);
        if (cluster == null) {
            throw new SQLException("Cluster " + clusterId + " existiert nicht");
        }
        return cluster;
    }

    private void persistClusterRewrite(
            Connection conn,
            long mapId,
            features.world.dungeon.dungeonmap.model.DungeonMap originalLayout,
            features.world.dungeon.dungeonmap.cluster.model.ClusterRewriteRequest rewriteRequest
    ) throws SQLException {
        if (conn == null || originalLayout == null || rewriteRequest == null || !rewriteRequest.hasChanges()) {
            return;
        }
        mapApplicationService.validateClusterRewrite(
                new features.world.dungeon.dungeonmap.api.ValidateClusterRewriteRequest(originalLayout, rewriteRequest));
        List<Long> persistedClusterIds = clusterRepository.persistRewrite(conn, mapId, rewriteRequest);
        mapObject.persistClusterRewriteRebounds(conn, originalLayout, rewriteRequest, persistedClusterIds);
    }

    private static features.world.dungeon.dungeonmap.cluster.model.ClusterRewriteRequest newClusterRewrite(
            long mapId,
            int levelZ,
            features.world.dungeon.geometry.GridArea area,
            String roomName
    ) {
        features.world.dungeon.geometry.GridArea resolvedArea = area == null ? features.world.dungeon.geometry.GridArea.empty() : area.onLevel(levelZ);
        if (resolvedArea.isEmpty()) {
            return features.world.dungeon.dungeonmap.cluster.model.ClusterRewriteRequest.of(List.of(), List.of());
        }
        features.world.dungeon.geometry.GridPoint center = resolvedArea.center();
        features.world.dungeon.dungeonmap.structure.model.Structure structure =
                features.world.dungeon.dungeonmap.structure.model.Structure.fromSpecification(
                        features.world.dungeon.dungeonmap.structure.model.StructureSpecification.ofLevel(
                                levelZ,
                                new features.world.dungeon.dungeonmap.structure.model.StructureSpecification.LevelSpecification(
                                        center,
                                        resolvedArea,
                                        resolvedArea,
                                        List.of(),
                                        List.of())));
        features.world.dungeon.model.structures.room.Room room = new features.world.dungeon.model.structures.room.Room(
                null,
                mapId,
                0L,
                roomName,
                Map.of(levelZ, center),
                null);
        features.world.dungeon.dungeonmap.cluster.model.Cluster cluster =
                features.world.dungeon.dungeonmap.cluster.model.Cluster.fromDefinition(
                        new features.world.dungeon.dungeonmap.cluster.model.ClusterDefinitionRequest(
                                null,
                                null,
                                mapId,
                                structure,
                                List.of(room)));
        return features.world.dungeon.dungeonmap.cluster.model.ClusterRewriteRequest.of(List.of(), List.of(cluster));
    }

    private static Set<features.world.dungeon.geometry.GridPoint> intersect(
            Set<features.world.dungeon.geometry.GridPoint> left,
            Set<features.world.dungeon.geometry.GridPoint> right
    ) {
        if (left == null || left.isEmpty() || right == null || right.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<features.world.dungeon.geometry.GridPoint> result = new LinkedHashSet<>();
        for (features.world.dungeon.geometry.GridPoint cell : left) {
            if (right.contains(cell)) {
                result.add(cell);
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static List<features.world.dungeon.model.structures.room.Room> rooms(features.world.dungeon.dungeonmap.model.DungeonMap layout) {
        if (layout == null) {
            return List.of();
        }
        return layout.clusters().stream()
                .flatMap(cluster -> cluster.roomTopology().rooms().stream())
                .toList();
    }

    private static features.world.dungeon.dungeonmap.structure.model.Structure roomStructure(
            features.world.dungeon.dungeonmap.model.DungeonMap layout,
            features.world.dungeon.model.structures.room.Room room
    ) {
        if (layout == null || room == null) {
            return features.world.dungeon.dungeonmap.structure.model.Structure.empty();
        }
        features.world.dungeon.dungeonmap.cluster.model.Cluster cluster = layout.findCluster(room.clusterId());
        return cluster == null ? features.world.dungeon.dungeonmap.structure.model.Structure.empty() : cluster.roomTopology().structureFor(room);
    }

    private static features.world.dungeon.model.structures.room.Room roomAtCell(
            features.world.dungeon.dungeonmap.model.DungeonMap layout,
            features.world.dungeon.geometry.GridPoint cell,
            int levelZ
    ) {
        features.world.dungeon.dungeonmap.cluster.model.Cluster cluster = layout == null ? null : layout.clusterAtCell(cell, levelZ);
        return cluster == null ? null : cluster.roomTopology().roomAt(cell, levelZ);
    }

    public record ClusterSurfaceRewriteRequest(
            long mapId,
            int levelZ,
            features.world.dungeon.geometry.GridArea cells,
            ClusterSurfaceRewriteMode mode
    ) {
        public ClusterSurfaceRewriteRequest {
            cells = cells == null ? features.world.dungeon.geometry.GridArea.empty() : cells.onLevel(levelZ);
            mode = mode == null ? ClusterSurfaceRewriteMode.PAINT : mode;
        }
    }

    public record ClusterFloorEditRequest(
            long mapId,
            int levelZ,
            features.world.dungeon.geometry.GridArea cells,
            ClusterFloorEditMode mode
    ) {
        public ClusterFloorEditRequest {
            cells = cells == null ? features.world.dungeon.geometry.GridArea.empty() : cells.onLevel(levelZ);
            mode = mode == null ? ClusterFloorEditMode.ADD : mode;
        }
    }

    public record ClusterBoundaryEditRequest(
            long mapId,
            long clusterId,
            int levelZ,
            features.world.dungeon.geometry.GridBoundary segments,
            ClusterBoundaryTarget target,
            ClusterBoundaryEditMode mode
    ) {
        public ClusterBoundaryEditRequest {
            segments = segments == null ? features.world.dungeon.geometry.GridBoundary.empty() : segments;
            target = target == null ? ClusterBoundaryTarget.WALL : target;
            mode = mode == null ? ClusterBoundaryEditMode.CREATE : mode;
        }
    }

    public record ClusterMoveRequest(
            long mapId,
            long clusterId,
            features.world.dungeon.geometry.GridTranslation translation
    ) {
        public ClusterMoveRequest {
            translation = translation == null ? features.world.dungeon.geometry.GridTranslation.none() : translation;
        }
    }

    public record ClusterDoorMoveRequest(
            long mapId,
            long clusterId,
            int levelZ,
            features.world.dungeon.geometry.GridSegment sourceBoundarySegment,
            features.world.dungeon.geometry.GridSegment targetBoundarySegment
    ) {
    }

    public record ClusterBootstrapRequest(
            long mapId,
            int levelZ,
            features.world.dungeon.geometry.GridArea cells,
            String roomName
    ) {
        public ClusterBootstrapRequest(long mapId) {
            this(mapId, 0, features.world.dungeon.geometry.GridPoint.cell(0, 0, 0).cellFootprint(), "Raum 1");
        }

        public ClusterBootstrapRequest {
            cells = cells == null ? features.world.dungeon.geometry.GridArea.empty() : cells.onLevel(levelZ);
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
