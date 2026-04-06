package features.world.dungeonmap.application.room;

import database.DatabaseManager;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.GridSegment2x;
import features.world.dungeonmap.model.objects.StairExit;
import features.world.dungeonmap.model.objects.StructureObject;
import features.world.dungeonmap.model.structures.cluster.InternalBoundaryType;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.connection.DoorConnectionCarrier;
import features.world.dungeonmap.model.structures.connection.DungeonConnection;
import features.world.dungeonmap.model.structures.connection.StairConnectionCarrier;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorNode;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.room.RoomNarration;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;
import features.world.dungeonmap.repository.DungeonCorridorRepository;
import features.world.dungeonmap.repository.DungeonLayoutRepository;
import features.world.dungeonmap.repository.DungeonRoomRepository;
import features.world.dungeonmap.repository.DungeonTransitionRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.function.Supplier;

/**
 * Central room/cluster workflow owner for editor-visible room mutations.
 *
 * <p>Paint, delete, boundary edits, cluster moves, narration writes, and traversability bootstrap all converge
 * here so tools and neighboring application flows do not keep parallel room workflow owners alive.
 */
public final class DungeonRoomApplicationService {

    private final DungeonLayoutRepository layoutRepository;
    private final DungeonCorridorRepository corridorRepository;
    private final DungeonRoomRepository roomRepository;
    private final DungeonTransitionRepository transitionRepository;

    public DungeonRoomApplicationService(
            DungeonLayoutRepository layoutRepository,
            DungeonCorridorRepository corridorRepository,
            DungeonRoomRepository roomRepository,
            DungeonTransitionRepository transitionRepository
    ) {
        this.layoutRepository = Objects.requireNonNull(layoutRepository, "layoutRepository");
        this.corridorRepository = Objects.requireNonNull(corridorRepository, "corridorRepository");
        this.roomRepository = Objects.requireNonNull(roomRepository, "roomRepository");
        this.transitionRepository = Objects.requireNonNull(transitionRepository, "transitionRepository");
    }

    public void paintCells(long mapId, int levelZ, Set<CellCoord> cells) throws SQLException {
        if (cells == null || cells.isEmpty()) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                paintCells(conn, mapId, levelZ, cells);
                return null;
            });
        }
    }

    public void deleteCells(long mapId, int levelZ, Set<CellCoord> cells) throws SQLException {
        if (cells == null || cells.isEmpty()) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                deleteCells(conn, mapId, levelZ, cells);
                return null;
            });
        }
    }

    public void addFloorCells(long mapId, int levelZ, Set<CellCoord> cells) throws SQLException {
        if (cells == null || cells.isEmpty()) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                editFloorCells(conn, mapId, levelZ, cells, false);
                return null;
            });
        }
    }

    public void deleteFloorCells(long mapId, int levelZ, Set<CellCoord> cells) throws SQLException {
        if (cells == null || cells.isEmpty()) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                editFloorCells(conn, mapId, levelZ, cells, true);
                return null;
            });
        }
    }

    public void editBoundary(
            long mapId,
            long clusterId,
            int levelZ,
            Collection<GridSegment2x> segments2x,
            InternalBoundaryType type,
            boolean deleteBoundary
    ) throws SQLException {
        if (segments2x == null || segments2x.isEmpty()) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                editBoundary(conn, mapId, clusterId, levelZ, segments2x, type, deleteBoundary);
                return null;
            });
        }
    }

    public void createDoor(long mapId, long clusterId, int levelZ, Collection<GridSegment2x> segments2x) throws SQLException {
        editDoor(mapId, clusterId, levelZ, segments2x, false);
    }

    public void deleteDoor(long mapId, long clusterId, int levelZ, Collection<GridSegment2x> segments2x) throws SQLException {
        editDoor(mapId, clusterId, levelZ, segments2x, true);
    }

    public void createExteriorDoor(long mapId, long clusterId, int levelZ, Collection<GridSegment2x> segments2x) throws SQLException {
        editExteriorDoor(mapId, clusterId, levelZ, segments2x, false);
    }

    public void deleteExteriorDoor(long mapId, long clusterId, int levelZ, Collection<GridSegment2x> segments2x) throws SQLException {
        editExteriorDoor(mapId, clusterId, levelZ, segments2x, true);
    }

    public void moveDoor(MoveDoorRequest request) throws SQLException {
        MoveDoorRequest resolvedRequest = Objects.requireNonNull(request, "request");
        if (resolvedRequest.mapId() <= 0
                || resolvedRequest.clusterId() <= 0
                || resolvedRequest.sourceBoundarySegment2x() == null
                || resolvedRequest.targetBoundarySegment2x() == null) {
            throw new IllegalArgumentException("Local door move requires mapId, clusterId, source boundary, and target boundary");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonLayout layout = requireLayout(conn, resolvedRequest.mapId());
                RoomCluster cluster = layout.findCluster(resolvedRequest.clusterId());
                if (cluster == null) {
                    return null;
                }
                RoomCluster updatedCluster = cluster.moveDoor(
                        resolvedRequest.levelZ(),
                        resolvedRequest.sourceBoundarySegment2x(),
                        resolvedRequest.targetBoundarySegment2x());
                if (updatedCluster != null) {
                    roomRepository.replaceClusters(conn, resolvedRequest.mapId(), List.of(cluster), List.of(updatedCluster));
                }
                return null;
            });
        }
    }

    public void paintCells(Connection conn, long mapId, int levelZ, Set<CellCoord> cells) throws SQLException {
        DungeonLayout layout = requireLayout(conn, mapId);
        List<RoomCluster> overlappingClusters = overlappingClustersAtLevel(layout, cells, levelZ).stream()
                .sorted(Comparator.comparing(cluster -> cluster.clusterId() == null ? Long.MAX_VALUE : cluster.clusterId()))
                .toList();
        if (overlappingClusters.isEmpty()) {
            roomRepository.createClusterWithRoom(conn, mapId, levelZ, cells, nextRoomName(layout, new LinkedHashSet<>()));
            return;
        }

        RoomCluster mergedCluster = overlappingClusters.getFirst().applyPaint(cells, overlappingClusters, levelZ);
        if (mergedCluster == null) {
            return;
        }

        persistClusterRewrite(conn, mapId, layout, overlappingClusters, List.of(mergedCluster));
    }

    public void deleteCells(Connection conn, long mapId, int levelZ, Set<CellCoord> cells) throws SQLException {
        DungeonLayout workingLayout = requireLayout(conn, mapId);
        Set<String> reservedNames = new LinkedHashSet<>();
        for (Room room : workingLayout.rooms()) {
            if (room != null && room.name() != null && !room.name().isBlank()) {
                reservedNames.add(room.name());
            }
        }

        List<Long> affectedClusterIds = overlappingClustersAtLevel(workingLayout, cells, levelZ).stream()
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
            List<RoomCluster> finalClusters = assignGeneratedClusterRoomNames(
                    cluster.applyDelete(cells, levelZ),
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
            Set<CellCoord> cells,
            boolean deleteFloor
    ) throws SQLException {
        if (cells == null || cells.isEmpty()) {
            return;
        }
        DungeonLayout workingLayout = requireLayout(conn, mapId);
        List<Room> affectedRooms = overlappingRoomsAtLevel(workingLayout, cells, levelZ);
        if (affectedRooms.isEmpty()) {
            return;
        }

        java.util.Map<Long, Set<CellCoord>> requestedByClusterId = new java.util.LinkedHashMap<>();
        for (Room room : affectedRooms) {
            if (room == null || room.roomId() == null) {
                continue;
            }
            Set<CellCoord> requestedCells = intersect(workingLayout.roomCellsAtLevel(room, levelZ), cells);
            if (requestedCells.isEmpty()) {
                continue;
            }
            if (deleteFloor) {
                Set<CellCoord> removedFloorCells = intersect(workingLayout.roomFloorCellsAtLevel(room, levelZ), requestedCells);
                if (removedFloorCells.isEmpty()) {
                    continue;
                }
                validateFloorDelete(workingLayout, room, levelZ, removedFloorCells);
            }
            requestedByClusterId.computeIfAbsent(room.clusterId(), ignored -> new LinkedHashSet<>()).addAll(requestedCells);
        }

        for (Long clusterId : requestedByClusterId.keySet().stream().sorted().toList()) {
            RoomCluster cluster = workingLayout.findCluster(clusterId);
            if (cluster == null) {
                continue;
            }
            Set<CellCoord> requestedCells = requestedByClusterId.getOrDefault(clusterId, Set.of());
            Set<CellCoord> currentFloorCells = new LinkedHashSet<>(cluster.structure().floorCellCoordsAtLevel(levelZ));
            Set<CellCoord> nextFloorCells = new LinkedHashSet<>(currentFloorCells);
            boolean changed;
            if (deleteFloor) {
                changed = nextFloorCells.removeAll(requestedCells);
            } else {
                changed = nextFloorCells.addAll(requestedCells);
            }
            if (!changed) {
                continue;
            }
            RoomCluster updatedCluster = new RoomCluster(
                    cluster.clusterId(),
                    cluster.mapId(),
                    cluster.center(),
                    cluster.structure().withFloorCellsAtLevel(levelZ, nextFloorCells),
                    cluster.rooms());
            persistClusterRewrite(conn, mapId, workingLayout, List.of(cluster), List.of(updatedCluster));
            workingLayout = requireLayout(conn, mapId);
        }
    }

    public void createDefaultRoom(Connection conn, long mapId) throws SQLException {
        // Brand-new dungeons must bootstrap their first room without rehydrating an empty layout first.
        roomRepository.createClusterWithRoom(
                conn,
                mapId,
                0,
                Set.of(new CellCoord(0, 0)),
                "Raum 1");
    }

    public void move(long mapId, long clusterId, CellCoord delta, int levelDelta) throws SQLException {
        boolean translate = delta != null && (delta.x() != 0 || delta.y() != 0);
        if (!translate && levelDelta == 0) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonLayout layout = requireLayout(conn, mapId);
                DungeonLayout movedLayout = layout.withMovedCluster(clusterId, delta, levelDelta);
                RoomCluster cluster = requireCluster(movedLayout, clusterId);
                roomRepository.saveMovedCluster(conn, cluster);
                persistUpdatedCorridors(conn, layout, movedLayout);
                return null;
            });
        }
    }

    public void saveNarration(long roomId, RoomNarration narration) throws SQLException {
        if (roomId <= 0) {
            throw new SQLException("Raum fehlt");
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn,
                    () -> roomRepository.replaceRoomNarration(conn, roomId, narration));
        }
    }

    public void ensureTraversableCell(Connection conn, long mapId, CellCoord cell, int levelZ) throws SQLException {
        if (cell == null) {
            return;
        }
        DungeonLayout layout = requireLayout(conn, mapId);
        if (layout.isTraversableCell(cell, levelZ)) {
            return;
        }
        Room room = layout.roomAtCell(cell, levelZ);
        if (room != null) {
            editFloorCells(conn, mapId, levelZ, Set.of(cell), false);
            return;
        }
        paintCells(conn, mapId, levelZ, Set.of(cell));
    }

    public void editBoundary(
            Connection conn,
            long mapId,
            long clusterId,
            int levelZ,
            Collection<GridSegment2x> segments2x,
            InternalBoundaryType type,
            boolean deleteBoundary
    ) throws SQLException {
        if (segments2x == null || segments2x.isEmpty()) {
            return;
        }
        DungeonLayout layout = requireLayout(conn, mapId);
        RoomCluster cluster = layout.findCluster(clusterId);
        if (cluster == null) {
            return;
        }
        RoomCluster updatedCluster = cluster.editBoundary(levelZ, segments2x, type, deleteBoundary);
        if (updatedCluster == null) {
            return;
        }

        persistClusterRewrite(conn, mapId, layout, List.of(cluster), List.of(updatedCluster));
    }

    private void editDoor(
            long mapId,
            long clusterId,
            int levelZ,
            Collection<GridSegment2x> segments2x,
            boolean deleteDoor
    ) throws SQLException {
        if (segments2x == null || segments2x.isEmpty()) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                editDoor(conn, mapId, clusterId, levelZ, segments2x, deleteDoor);
                return null;
            });
        }
    }

    private void editDoor(
            Connection conn,
            long mapId,
            long clusterId,
            int levelZ,
            Collection<GridSegment2x> segments2x,
            boolean deleteDoor
    ) throws SQLException {
        DungeonLayout layout = requireLayout(conn, mapId);
        RoomCluster cluster = layout.findCluster(clusterId);
        if (cluster == null) {
            return;
        }
        List<GridSegment2x> editableSegments = segments2x.stream()
                .filter(Objects::nonNull)
                .filter(segment2x -> deleteDoor
                        ? cluster.canDeleteDoor(levelZ, segment2x)
                        : cluster.canCreateDoor(levelZ, segment2x))
                .toList();
        if (editableSegments.isEmpty()) {
            return;
        }
        RoomCluster updatedCluster = cluster.editBoundary(levelZ, editableSegments, InternalBoundaryType.DOOR, deleteDoor);
        if (updatedCluster == null) {
            return;
        }
        roomRepository.replaceClusters(conn, mapId, List.of(cluster), List.of(updatedCluster));
    }

    private void editExteriorDoor(
            long mapId,
            long clusterId,
            int levelZ,
            Collection<GridSegment2x> segments2x,
            boolean deleteDoor
    ) throws SQLException {
        if (segments2x == null || segments2x.isEmpty()) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                editExteriorDoor(conn, mapId, clusterId, levelZ, segments2x, deleteDoor);
                return null;
            });
        }
    }

    private void editExteriorDoor(
            Connection conn,
            long mapId,
            long clusterId,
            int levelZ,
            Collection<GridSegment2x> segments2x,
            boolean deleteDoor
    ) throws SQLException {
        DungeonLayout layout = requireLayout(conn, mapId);
        RoomCluster cluster = layout.findCluster(clusterId);
        RoomCluster projectedCluster = cluster == null ? null : cluster.projectedToLevel(levelZ);
        if (projectedCluster == null) {
            return;
        }
        List<GridSegment2x> editableSegments = segments2x.stream()
                .filter(Objects::nonNull)
                .filter(segment2x -> deleteDoor
                        ? projectedCluster.canDeleteExteriorOpening(levelZ, segment2x)
                        : projectedCluster.canCreateExteriorOpening(levelZ, segment2x))
                .toList();
        if (editableSegments.isEmpty()) {
            return;
        }
        RoomCluster updatedCluster = cluster.withExteriorOpenings(levelZ, editableSegments, deleteDoor);
        if (updatedCluster == null || updatedCluster == cluster) {
            return;
        }
        roomRepository.replaceClusters(conn, mapId, List.of(cluster), List.of(updatedCluster));
    }

    private static List<RoomCluster> overlappingClustersAtLevel(DungeonLayout layout, Set<CellCoord> cells, int levelZ) {
        return layout.overlappingClusters(cells).stream()
                .filter(cluster -> cluster != null && cluster.rooms().stream()
                        .anyMatch(room -> room != null
                                && layout.roomLevels(room).contains(levelZ)))
                .toList();
    }

    private static List<Room> overlappingRoomsAtLevel(DungeonLayout layout, Set<CellCoord> cells, int levelZ) {
        if (layout == null || cells == null || cells.isEmpty()) {
            return List.of();
        }
        return layout.rooms().stream()
                .filter(room -> room != null
                        && room.roomId() != null
                        && !intersect(layout.roomCellsAtLevel(room, levelZ), cells).isEmpty())
                .sorted(Comparator.comparing(Room::roomId))
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
        DungeonLayout layout = layoutRepository.loadLayout(conn, mapId);
        if (layout == null) {
            throw new SQLException("Dungeon " + mapId + " konnte nicht geladen werden");
        }
        return layout;
    }

    private static RoomCluster requireCluster(DungeonLayout layout, long clusterId) throws SQLException {
        RoomCluster cluster = layout == null ? null : layout.findCluster(clusterId);
        if (cluster == null) {
            throw new SQLException("Cluster " + clusterId + " existiert nicht");
        }
        return cluster;
    }

    private void persistClusterRewrite(
            Connection conn,
            long mapId,
            DungeonLayout originalLayout,
            List<RoomCluster> originalClusters,
            List<RoomCluster> finalClusters
    ) throws SQLException {
        if (conn == null || originalLayout == null) {
            return;
        }
        Set<Long> affectedRoomIds = affectedRoomIds(originalClusters);
        DungeonLayout rewrittenLayout = originalLayout.withReplacedClusters(originalClusters, finalClusters);
        validateRoomRewriteCorridors(originalLayout, rewrittenLayout, affectedRoomIds);
        validateRoomRewriteTransitions(originalLayout, rewrittenLayout, affectedRoomIds);
        roomRepository.replaceClusters(conn, mapId, originalClusters, finalClusters);
        if (affectedRoomIds.isEmpty()) {
            return;
        }
        DungeonLayout persistedRoomLayout = loadRoomRewriteLayout(conn, originalLayout, mapId);
        persistReboundCorridors(conn, originalLayout, persistedRoomLayout, affectedRoomIds);
        persistReboundTransitions(conn, originalLayout, persistedRoomLayout, affectedRoomIds);
    }

    private void persistUpdatedCorridors(Connection conn, DungeonLayout originalLayout, DungeonLayout movedLayout) throws SQLException {
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
            DungeonLayout originalLayout,
            DungeonLayout rewrittenLayout,
            Set<Long> affectedRoomIds
    ) {
        if (originalLayout == null || rewrittenLayout == null || affectedRoomIds == null || affectedRoomIds.isEmpty()) {
            return;
        }
        for (Corridor corridor : originalLayout.corridors()) {
            if (corridor != null && touchesAffectedRooms(corridor, affectedRoomIds)) {
                corridor.validateRoomBindingsForRewrite(rewrittenLayout, affectedRoomIds);
            }
        }
    }

    private void persistReboundCorridors(
            Connection conn,
            DungeonLayout originalLayout,
            DungeonLayout rewrittenRoomLayout,
            Set<Long> affectedRoomIds
    ) throws SQLException {
        if (conn == null || originalLayout == null || rewrittenRoomLayout == null || affectedRoomIds == null || affectedRoomIds.isEmpty()) {
            return;
        }
        for (Corridor originalCorridor : originalLayout.corridors()) {
            if (originalCorridor == null || originalCorridor.corridorId() == null || !touchesAffectedRooms(originalCorridor, affectedRoomIds)) {
                continue;
            }
            Corridor reboundCorridor = originalCorridor.reboundRoomBindings(rewrittenRoomLayout, affectedRoomIds);
            if (reboundCorridor != originalCorridor) {
                corridorRepository.save(conn, reboundCorridor, rewrittenRoomLayout);
            }
        }
    }

    private void validateRoomRewriteTransitions(
            DungeonLayout originalLayout,
            DungeonLayout rewrittenLayout,
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
            DungeonLayout originalLayout,
            DungeonLayout rewrittenRoomLayout,
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
                transitionRepository.updateLocalConnection(conn, transition.transitionId(), reboundConnection);
            }
        }
    }

    private DungeonLayout loadRoomRewriteLayout(Connection conn, DungeonLayout originalLayout, long mapId) throws SQLException {
        List<Room> rooms = roomRepository.loadRooms(conn, mapId);
        List<RoomCluster> clusters = roomRepository.loadClusters(conn, mapId, rooms);
        return new DungeonLayout(
                mapId,
                originalLayout == null ? null : originalLayout.name(),
                originalLayout == null ? List.of() : originalLayout.corridors(),
                clusters,
                originalLayout == null ? List.of() : originalLayout.stairs(),
                originalLayout == null ? List.of() : originalLayout.transitions(),
                roomRepository.loadClusterLevels(conn, mapId));
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
                .filter(endpoint -> endpoint.type() == features.world.dungeonmap.model.structures.connection.ConnectionEndpointType.ROOM)
                .map(ConnectionEndpoint::id)
                .filter(Objects::nonNull)
                .anyMatch(affectedRoomIds::contains);
    }

    private static DungeonConnection reboundTransitionLocalConnection(
            DungeonLayout layout,
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
                    || entryEndpoint.type() != features.world.dungeonmap.model.structures.connection.ConnectionEndpointType.ROOM
                    || !affectedRoomIds.contains(entryEndpoint.id())) {
                return localConnection;
            }
            Room reboundRoom = resolveTransitionDoorRoom(
                    layout,
                    localConnection.levelZ(),
                    localConnection.anchorSegment2x(),
                    requirePersistedRoomId);
            return new DungeonConnection(
                    localConnection.kind(),
                    localConnection.ownerId(),
                    localConnection.mapId(),
                    localConnection.levelZ(),
                    new DoorConnectionCarrier(localConnection.doorShape(), localConnection.anchorSegment2x(), localConnection.blocksPassage()),
                    List.of(ConnectionEndpoint.room(reboundRoom.roomId()), ConnectionEndpoint.transition(transition.transitionId())));
        }
        if (localConnection.stairCarrier() != null) {
            ConnectionEndpoint entryEndpoint = localConnection.entryEndpoint();
            if (entryEndpoint == null
                    || entryEndpoint.type() != features.world.dungeonmap.model.structures.connection.ConnectionEndpointType.ROOM
                    || !affectedRoomIds.contains(entryEndpoint.id())) {
                return localConnection;
            }
            StairConnectionCarrier stairCarrier = localConnection.stairCarrier();
            Room reboundRoom = layout.roomWithFloorAtCell(stairCarrier.anchorCell(), stairCarrier.anchorLevelZ());
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
                            stairCarrier.shapeSpec(),
                            stairCarrier.minLevelZ(),
                            stairCarrier.maxLevelZ(),
                            StructureObject.fromTilePath(stairCarrier.tilePath(), stairCarrier.stopLevels())),
                    List.of(ConnectionEndpoint.room(reboundRoom.roomId()), ConnectionEndpoint.transition(transition.transitionId())));
        }
        return localConnection;
    }

    private static Room resolveTransitionDoorRoom(
            DungeonLayout layout,
            int levelZ,
            GridSegment2x boundarySegment2x,
            boolean requirePersistedRoomId
    ) {
        if (layout == null || boundarySegment2x == null) {
            throw new IllegalArgumentException("Transition door rebound requires a boundary segment");
        }
        Room reboundRoom = null;
        for (CellCoord cell : boundarySegment2x.touchingCells().stream().sorted(CellCoord.ORDER).toList()) {
            Room room = layout.roomAtCell(cell, levelZ);
            if (room == null) {
                continue;
            }
            var direction = boundarySegment2x.directionFrom(cell);
            if (direction == null
                    || !layout.roomBoundaryEdgesAtLevel(room, levelZ).contains(boundarySegment2x)
                    || layout.roomAtCell(cell.add(direction.delta()), levelZ) != null) {
                continue;
            }
            if (reboundRoom != null && !Objects.equals(reboundRoom.roomId(), room.roomId())) {
                throw new IllegalArgumentException("Transition door no longer resolves to exactly one exterior room boundary");
            }
            reboundRoom = room;
        }
        if (reboundRoom == null) {
            throw new IllegalArgumentException("Transition door no longer resolves to an exterior room boundary");
        }
        if (requirePersistedRoomId && reboundRoom.roomId() == null) {
            throw new IllegalArgumentException("Transition door rebound requires a persisted room id");
        }
        return reboundRoom;
    }

    private static Set<Long> affectedRoomIds(List<RoomCluster> clusters) {
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

    private static Set<CellCoord> intersect(Set<CellCoord> left, Set<CellCoord> right) {
        if (left == null || left.isEmpty() || right == null || right.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<CellCoord> result = new LinkedHashSet<>();
        for (CellCoord cell : left) {
            if (right.contains(cell)) {
                result.add(cell);
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static void validateFloorDelete(
            DungeonLayout layout,
            Room room,
            int levelZ,
            Set<CellCoord> removedFloorCells
    ) throws SQLException {
        if (layout == null || room == null || room.roomId() == null || removedFloorCells == null || removedFloorCells.isEmpty()) {
            return;
        }
        for (Corridor corridor : layout.corridors()) {
            if (corridor == null || corridor.levelZ() != levelZ) {
                continue;
            }
            for (CorridorNode node : corridor.nodes()) {
                if (node != null
                        && node.isRoomBound()
                        && Objects.equals(node.roomId(), room.roomId())
                        && removedFloorCells.contains(node.roomCell())) {
                    throw new SQLException("Boden unter einem Corridor-Anker kann nicht entfernt werden.");
                }
            }
        }
        for (DungeonTransition transition : layout.transitionsAtLevel(levelZ)) {
            if (transition != null
                    && transition.transitionId() != null
                    && transition.localConnection() != null
                    && transition.localConnection().occupiedPositions(layout).stream()
                    .filter(point -> point != null && point.z() == levelZ)
                    .map(point -> point.projectedCell())
                    .anyMatch(removedFloorCells::contains)) {
                throw new SQLException("Boden unter einem platzierten Übergang kann nicht entfernt werden.");
            }
        }
        for (DungeonStair stair : layout.stairsAtLevel(levelZ)) {
            if (stair == null || stair.stairId() == null) {
                continue;
            }
            boolean usesRemovedExit = stair.exitsAtLevel(levelZ).stream()
                    .map(StructureObject.StairStop::position)
                    .filter(Objects::nonNull)
                    .map(position -> position.projectedCell())
                    .anyMatch(removedFloorCells::contains);
            if (usesRemovedExit) {
                throw new SQLException("Boden unter einem Treppenanschluss kann nicht entfernt werden.");
            }
        }
    }

    private static List<RoomCluster> assignGeneratedClusterRoomNames(List<RoomCluster> clusters, Supplier<String> roomNameSupplier) {
        if (clusters == null || roomNameSupplier == null) {
            return clusters;
        }
        boolean changed = false;
        List<RoomCluster> renamedClusters = new java.util.ArrayList<>(clusters.size());
        for (RoomCluster cluster : clusters) {
            if (cluster == null) {
                renamedClusters.add(null);
                continue;
            }
            List<Room> renamedRooms = assignGeneratedNamesToRooms(cluster.rooms(), roomNameSupplier);
            if (renamedRooms.equals(cluster.rooms())) {
                renamedClusters.add(cluster);
                continue;
            }
            renamedClusters.add(new RoomCluster(
                    cluster.clusterId(),
                    cluster.mapId(),
                    cluster.center(),
                    cluster.structure(),
                    renamedRooms));
            changed = true;
        }
        return changed ? List.copyOf(renamedClusters) : clusters;
    }

    private static List<Room> assignGeneratedNamesToRooms(List<Room> rooms, Supplier<String> roomNameSupplier) {
        if (rooms == null || rooms.isEmpty()) {
            return List.of();
        }
        boolean changed = false;
        List<Room> renamedRooms = new java.util.ArrayList<>(rooms.size());
        for (Room room : rooms) {
            if (room == null || room.roomId() != null || room.name() != null && !room.name().isBlank()) {
                renamedRooms.add(room);
                continue;
            }
            String generatedName = roomNameSupplier.get();
            Room renamedRoom = room.withName(
                    generatedName == null || generatedName.isBlank() ? "Raum neu" : generatedName.trim());
            renamedRooms.add(renamedRoom);
            changed = true;
        }
        return changed ? List.copyOf(renamedRooms) : rooms;
    }

    public record MoveDoorRequest(
            long mapId,
            long clusterId,
            int levelZ,
            GridSegment2x sourceBoundarySegment2x,
            GridSegment2x targetBoundarySegment2x
    ) {
    }
}
