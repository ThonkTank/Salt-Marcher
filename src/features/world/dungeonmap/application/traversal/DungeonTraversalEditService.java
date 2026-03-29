package features.world.dungeonmap.application.traversal;

import database.DatabaseManager;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.traversal.Traversal;
import features.world.dungeonmap.model.structures.traversal.TraversalRoute;
import features.world.dungeonmap.model.structures.traversal.TraversalRoutingSnapshot;
import features.world.dungeonmap.model.structures.traversal.TraversalSegmentRef;
import features.world.dungeonmap.model.structures.traversal.TraversalSegmentRefs;
import features.world.dungeonmap.persistence.DungeonTraversalWriteRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class DungeonTraversalEditService {

    private final DungeonTraversalWriteRepository traversalWriteRepository;
    private final DungeonTraversalPersistenceService traversalPersistenceService;

    public DungeonTraversalEditService(
            DungeonTraversalWriteRepository traversalWriteRepository,
            DungeonTraversalPersistenceService traversalPersistenceService
    ) {
        this.traversalWriteRepository = Objects.requireNonNull(traversalWriteRepository, "traversalWriteRepository");
        this.traversalPersistenceService = Objects.requireNonNull(traversalPersistenceService, "traversalPersistenceService");
    }

    public void create(DungeonLayout layout, TraversalTarget start, TraversalTarget end) throws SQLException {
        requireLayout(layout);
        if (start == null || end == null || Objects.equals(start.targetKey(), end.targetKey())) {
            return;
        }
        if (start instanceof TraversalTarget.Room startRoom && end instanceof TraversalTarget.Room endRoom) {
            createBetweenRooms(layout, List.of(startRoom.roomId(), endRoom.roomId()));
            return;
        }
        if (start instanceof TraversalTarget.Room startRoom && end instanceof TraversalTarget.CorridorSegment corridorSegment) {
            extend(layout, new TraversalSegmentRef.CorridorSegment(corridorSegment.corridorId()), startRoom.roomId());
            return;
        }
        if (start instanceof TraversalTarget.Room startRoom && end instanceof TraversalTarget.StairSegment stairSegment) {
            extend(layout, new TraversalSegmentRef.StairSegment(stairSegment.stairId()), startRoom.roomId());
            return;
        }
        if (start instanceof TraversalTarget.CorridorSegment corridorSegment && end instanceof TraversalTarget.Room endRoom) {
            extend(layout, new TraversalSegmentRef.CorridorSegment(corridorSegment.corridorId()), endRoom.roomId());
            return;
        }
        if (start instanceof TraversalTarget.StairSegment stairSegment && end instanceof TraversalTarget.Room endRoom) {
            extend(layout, new TraversalSegmentRef.StairSegment(stairSegment.stairId()), endRoom.roomId());
            return;
        }
        merge(layout, toSegmentRef(start), toSegmentRef(end));
    }

    public void extend(DungeonLayout layout, TraversalSegmentRef segment, long roomId) throws SQLException {
        requireLayout(layout);
        Traversal traversal = requireTraversal(layout, segment);
        Set<Long> mergedRoomIds = new LinkedHashSet<>(traversal.roomIds());
        mergedRoomIds.add(roomId);
        rejectSameClusterOnlyTraversal(layout, mergedRoomIds);
        persistTraversal(layout, traversal.withAddedRoom(roomId), null);
    }

    public void merge(DungeonLayout layout, TraversalSegmentRef left, TraversalSegmentRef right) throws SQLException {
        requireLayout(layout);
        Traversal kept = requireTraversal(layout, left);
        Traversal merged = requireTraversal(layout, right);
        if (Objects.equals(kept.traversalId(), merged.traversalId())) {
            return;
        }
        Set<Long> mergedRoomIds = new LinkedHashSet<>(kept.roomIds());
        mergedRoomIds.addAll(merged.roomIds());
        rejectSameClusterOnlyTraversal(layout, mergedRoomIds);
        persistTraversal(layout, kept.mergedWith(merged), merged.traversalId());
    }

    public void deleteBySegment(DungeonLayout layout, TraversalSegmentRef segment) throws SQLException {
        requireLayout(layout);
        Traversal traversal = requireTraversal(layout, segment);
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                traversalPersistenceService.deleteTraversal(conn, traversal.traversalId());
                return null;
            });
        }
    }

    private void createBetweenRooms(DungeonLayout layout, List<Long> roomIds) throws SQLException {
        Set<Long> requestedRoomIds = roomIds == null ? Set.of() : Set.copyOf(roomIds.stream()
                .filter(Objects::nonNull)
                .toList());
        if (requestedRoomIds.size() < 2 || layout.findTraversalContainingAllRooms(requestedRoomIds) != null) {
            return;
        }
        rejectSameClusterOnlyTraversal(layout, requestedRoomIds);
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                long traversalId = traversalWriteRepository.insertTraversal(conn, layout.mapId());
                Traversal traversal = Traversal.resolved(
                        traversalId,
                        layout.mapId(),
                        roomIds,
                        null,
                        TraversalSegmentRefs.empty());
                persistTraversal(conn, layout, traversal, null);
                return null;
            });
        }
    }

    private void persistTraversal(DungeonLayout layout, Traversal traversal, Long deletedTraversalId) throws SQLException {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                persistTraversal(conn, layout, traversal, deletedTraversalId);
                return null;
            });
        }
    }

    private void persistTraversal(
            Connection conn,
            DungeonLayout layout,
            Traversal traversal,
            Long deletedTraversalId
    ) throws SQLException {
        TraversalRoute traversalRoute = traversal.isPersistable()
                ? traversal.route(TraversalRoutingSnapshot.fromLayout(layout))
                : TraversalRoute.empty();
        traversalPersistenceService.persistTraversal(conn, layout, traversal, traversalRoute);
        if (deletedTraversalId != null) {
            traversalPersistenceService.deleteTraversal(conn, deletedTraversalId);
        }
    }

    private static TraversalSegmentRef toSegmentRef(TraversalTarget target) {
        if (target instanceof TraversalTarget.CorridorSegment corridorSegment) {
            return new TraversalSegmentRef.CorridorSegment(corridorSegment.corridorId());
        }
        if (target instanceof TraversalTarget.StairSegment stairSegment) {
            return new TraversalSegmentRef.StairSegment(stairSegment.stairId());
        }
        return null;
    }

    private static Traversal requireTraversal(DungeonLayout layout, TraversalSegmentRef segment) {
        Traversal traversal = null;
        if (segment instanceof TraversalSegmentRef.CorridorSegment corridorSegment) {
            traversal = layout.findTraversalForCorridor(corridorSegment.corridorId());
        } else if (segment instanceof TraversalSegmentRef.StairSegment stairSegment) {
            traversal = layout.findTraversalForStair(stairSegment.stairId());
        }
        if (traversal == null) {
            throw new IllegalArgumentException("Unbekannte Traversal-Verbindung");
        }
        return traversal;
    }

    private static void requireLayout(DungeonLayout layout) throws SQLException {
        if (layout == null) {
            throw new SQLException("Dungeon konnte nicht geladen werden");
        }
    }

    private static void rejectSameClusterOnlyTraversal(DungeonLayout layout, Set<Long> roomIds) {
        if (isSameClusterOnlyTraversal(layout, roomIds)) {
            throw new IllegalArgumentException("Verbindungen innerhalb eines Clusters sind nicht erlaubt");
        }
    }

    private static boolean isSameClusterOnlyTraversal(DungeonLayout layout, Set<Long> roomIds) {
        if (layout == null || roomIds == null || roomIds.size() < 2) {
            return false;
        }
        Set<Long> clusterIds = new LinkedHashSet<>();
        for (Long roomId : roomIds) {
            if (roomId == null) {
                continue;
            }
            var room = layout.findRoom(roomId);
            if (room == null) {
                return false;
            }
            clusterIds.add(room.clusterId());
            if (clusterIds.size() > 1) {
                return false;
            }
        }
        return clusterIds.size() == 1;
    }
}
