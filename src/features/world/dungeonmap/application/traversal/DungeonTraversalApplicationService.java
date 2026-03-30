package features.world.dungeonmap.application.traversal;

import database.DatabaseManager;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.cluster.ClusterRewrite;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.traversal.Traversal;
import features.world.dungeonmap.model.structures.traversal.TraversalRoute;
import features.world.dungeonmap.model.structures.traversal.TraversalRoutingContext;
import features.world.dungeonmap.model.structures.traversal.TraversalRoutingSnapshot;
import features.world.dungeonmap.model.structures.traversal.TraversalSegmentRef;
import features.world.dungeonmap.model.structures.traversal.TraversalSegmentRefs;
import features.world.dungeonmap.persistence.DungeonTraversalWriteRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class DungeonTraversalApplicationService {

    private final DungeonTraversalWriteRepository traversalWriteRepository;
    private final DungeonTraversalStructureCommitter structureCommitter;

    public DungeonTraversalApplicationService(
            DungeonTraversalWriteRepository traversalWriteRepository,
            DungeonTraversalStructureCommitter structureCommitter
    ) {
        this.traversalWriteRepository = Objects.requireNonNull(traversalWriteRepository, "traversalWriteRepository");
        this.structureCommitter = Objects.requireNonNull(structureCommitter, "structureCommitter");
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
        persistTraversalChange(layout, traversal.withAddedRoom(roomId), null);
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
        persistTraversalChange(layout, kept.mergedWith(merged), merged.traversalId());
    }

    public void deleteBySegment(DungeonLayout layout, TraversalSegmentRef segment) throws SQLException {
        requireLayout(layout);
        Traversal traversal = requireTraversal(layout, segment);
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                deleteTraversal(conn, traversal.traversalId());
                return null;
            });
        }
    }

    public RewriteResult rewriteForClusterRewrite(
            DungeonLayout beforeLayout,
            Map<Long, Traversal> traversalsById,
            ClusterRewrite rewrite
    ) {
        if (beforeLayout == null || rewrite == null || rewrite.isNoOp()) {
            return unchanged(traversalsById);
        }
        Map<Long, Traversal> rewrittenTraversals = applyRoomRewrite(beforeLayout, traversalsById, rewrite);
        DungeonLayout rewrittenLayout = beforeLayout.applying(rewrite);
        return rewrite(
                beforeLayout,
                rewrittenLayout,
                rewrittenTraversals,
                beforeLayout.traversalIdsAffectedBy(rewrite),
                rewrite.deletedClusterIds());
    }

    public RewriteResult rewriteForLayoutChange(
            DungeonLayout beforeLayout,
            DungeonLayout rewrittenLayout,
            Map<Long, Traversal> traversalsById,
            Set<Long> affectedRoomIds,
            Set<Long> affectedClusterIds,
            Set<Long> deletedClusterIds
    ) {
        if (beforeLayout == null || rewrittenLayout == null) {
            return unchanged(traversalsById);
        }
        return rewrite(
                beforeLayout,
                rewrittenLayout,
                traversalsById,
                beforeLayout.traversalIdsAffectedBy(affectedRoomIds, affectedClusterIds),
                deletedClusterIds);
    }

    public void persistTraversals(
            Connection conn,
            DungeonLayout previousLayout,
            Map<Long, Traversal> traversalsById,
            Map<Long, TraversalRoute> traversalRoutesByTraversalId
    ) throws SQLException {
        if (traversalsById == null || traversalsById.isEmpty()) {
            return;
        }
        Map<Long, TraversalRoute> requestedRoutesByTraversalId = traversalRoutesByTraversalId == null
                ? Map.of()
                : traversalRoutesByTraversalId;
        for (Traversal traversal : traversalsById.values()) {
            TraversalRoute traversalRoute = traversal == null || traversal.traversalId() == null
                    ? TraversalRoute.empty()
                    : requestedRoutesByTraversalId.get(traversal.traversalId());
            persistTraversal(conn, previousLayout, traversal, traversalRoute);
        }
    }

    public record RewriteResult(
            Map<Long, Traversal> traversalsById,
            Set<Long> affectedTraversalIds,
            Map<Long, TraversalRoute> traversalRoutesByTraversalId
    ) {
        public RewriteResult {
            traversalsById = traversalsById == null ? Map.of() : Map.copyOf(traversalsById);
            affectedTraversalIds = affectedTraversalIds == null ? Set.of() : Set.copyOf(affectedTraversalIds);
            traversalRoutesByTraversalId = traversalRoutesByTraversalId == null
                    ? Map.of()
                    : Map.copyOf(traversalRoutesByTraversalId);
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
                persistTraversalChange(conn, layout, traversal, null);
                return null;
            });
        }
    }

    private void persistTraversalChange(DungeonLayout layout, Traversal traversal, Long deletedTraversalId) throws SQLException {
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                persistTraversalChange(conn, layout, traversal, deletedTraversalId);
                return null;
            });
        }
    }

    private void persistTraversalChange(
            Connection conn,
            DungeonLayout layout,
            Traversal traversal,
            Long deletedTraversalId
    ) throws SQLException {
        TraversalRoutingSnapshot routingSnapshot = TraversalRoutingSnapshot.fromLayout(layout);
        TraversalRoute traversalRoute = traversal != null && traversal.isPersistable()
                ? traversal.route(routingSnapshot)
                : TraversalRoute.empty();
        persistTraversal(conn, layout, traversal, traversalRoute);
        if (deletedTraversalId != null) {
            deleteTraversal(conn, deletedTraversalId);
        }
    }

    private void persistTraversal(
            Connection conn,
            DungeonLayout previousLayout,
            Traversal traversal,
            TraversalRoute traversalRoute
    ) throws SQLException {
        if (traversal == null || traversal.traversalId() == null) {
            return;
        }
        if (!traversal.isPersistable()) {
            deleteTraversal(conn, traversal.traversalId());
            return;
        }
        TraversalRoute routeToPersist = requireExplicitRoute(previousLayout, traversal, traversalRoute);
        traversalWriteRepository.replaceTraversalRooms(conn, traversal.traversalId(), traversal.roomIds());
        traversalWriteRepository.replaceTraversalWaypoints(conn, traversal.traversalId(), traversal.bindings().waypoints());
        traversalWriteRepository.replaceTraversalDoorBindings(conn, traversal.traversalId(), traversal.bindings().doorBindings());
        structureCommitter.persistStructures(conn, previousLayout, traversal, routeToPersist);
    }

    private void deleteTraversal(Connection conn, long traversalId) throws SQLException {
        structureCommitter.deleteStructuresForTraversal(conn, traversalId);
        traversalWriteRepository.deleteTraversal(conn, traversalId);
    }

    private static RewriteResult rewrite(
            DungeonLayout beforeLayout,
            DungeonLayout rewrittenLayout,
            Map<Long, Traversal> traversalsById,
            Set<Long> affectedTraversalIds,
            Set<Long> deletedClusterIds
    ) {
        Map<Long, Traversal> sourceTraversals = traversalsById == null ? Map.of() : Map.copyOf(traversalsById);
        if (sourceTraversals.isEmpty()) {
            return new RewriteResult(Map.of(), Set.of(), Map.of());
        }
        Set<Long> normalizedAffectedTraversalIds = affectedTraversalIds == null ? Set.of() : Set.copyOf(affectedTraversalIds);
        if (normalizedAffectedTraversalIds.isEmpty()) {
            return new RewriteResult(sourceTraversals, Set.of(), Map.of());
        }

        TraversalRoutingContext routingContext = new TraversalRoutingContext(
                TraversalRoutingSnapshot.fromLayout(beforeLayout),
                TraversalRoutingSnapshot.fromLayout(rewrittenLayout),
                normalizedAffectedTraversalIds,
                deletedClusterIds);
        LinkedHashMap<Long, Traversal> reanchoredTraversalsById = new LinkedHashMap<>();
        LinkedHashMap<Long, TraversalRoute> traversalRoutesByTraversalId = new LinkedHashMap<>();
        for (Map.Entry<Long, Traversal> entry : sourceTraversals.entrySet()) {
            Traversal traversal = entry.getValue();
            if (traversal == null) {
                continue;
            }
            Traversal reanchoredTraversal = traversal.reanchoredTo(routingContext);
            reanchoredTraversalsById.put(entry.getKey(), reanchoredTraversal);
            if (routingContext.affects(reanchoredTraversal.traversalId()) && reanchoredTraversal.isPersistable()) {
                traversalRoutesByTraversalId.put(
                        reanchoredTraversal.traversalId(),
                        TraversalStructureIdentityResolver.apply(
                                reanchoredTraversal.route(routingContext.rewrittenSnapshot()),
                                reanchoredTraversal.segmentRefs()));
            }
        }
        return new RewriteResult(
                reanchoredTraversalsById,
                normalizedAffectedTraversalIds,
                traversalRoutesByTraversalId);
    }

    private static RewriteResult unchanged(Map<Long, Traversal> traversalsById) {
        return new RewriteResult(
                traversalsById == null ? Map.of() : Map.copyOf(traversalsById),
                Set.of(),
                Map.of());
    }

    private static Map<Long, Traversal> applyRoomRewrite(
            DungeonLayout layout,
            Map<Long, Traversal> traversalsById,
            ClusterRewrite rewrite
    ) {
        if (layout == null || traversalsById == null || traversalsById.isEmpty() || rewrite == null || rewrite.isNoOp()) {
            return traversalsById == null ? Map.of() : Map.copyOf(traversalsById);
        }
        Map<Long, Traversal> result = new LinkedHashMap<>(traversalsById);
        applyMergedRoomRewrite(result, rewrite);
        applyDeletedRoomRewrite(result, rewrite.deletedRoomIds());
        applySplitRoomRewrite(layout, result, rewrite);
        return Map.copyOf(result);
    }

    private static void applyMergedRoomRewrite(Map<Long, Traversal> traversalsById, ClusterRewrite rewrite) {
        Long replacementRoomId = mergedReplacementRoomId(rewrite);
        if (replacementRoomId == null || rewrite.mergedRoomIds().isEmpty()) {
            return;
        }
        for (Map.Entry<Long, Traversal> entry : traversalsById.entrySet()) {
            Traversal traversal = entry.getValue();
            if (traversal == null || !traversal.dependsOnAnyRoom(rewrite.mergedRoomIds())) {
                continue;
            }
            entry.setValue(traversal.withMergedRooms(rewrite.mergedRoomIds(), replacementRoomId));
        }
    }

    private static void applyDeletedRoomRewrite(Map<Long, Traversal> traversalsById, Set<Long> deletedRoomIds) {
        if (deletedRoomIds == null || deletedRoomIds.isEmpty()) {
            return;
        }
        for (Long roomId : deletedRoomIds) {
            for (Map.Entry<Long, Traversal> entry : traversalsById.entrySet()) {
                Traversal traversal = entry.getValue();
                if (traversal == null || !traversal.connectsRoom(roomId)) {
                    continue;
                }
                entry.setValue(traversal.withRemovedRoom(roomId));
            }
        }
    }

    private static void applySplitRoomRewrite(
            DungeonLayout layout,
            Map<Long, Traversal> traversalsById,
            ClusterRewrite rewrite
    ) {
        for (Map.Entry<Long, List<Room>> entry : rewrite.splitFragmentsBySourceRoomId().entrySet()) {
            if (entry.getValue().size() <= 1) {
                continue;
            }
            Long originalRoomId = entry.getKey();
            for (Long traversalId : layout.traversalIdsAffectedBy(Set.of(originalRoomId), Set.of())) {
                Traversal traversal = traversalsById.get(traversalId);
                if (traversal == null) {
                    continue;
                }
                Long replacementRoomId = splitReplacementRoomId(traversal, layout, originalRoomId, entry.getValue());
                if (replacementRoomId != null) {
                    traversalsById.put(traversalId, traversal.withReplacedRoom(originalRoomId, replacementRoomId));
                }
            }
        }
    }

    private static Long splitReplacementRoomId(
            Traversal traversal,
            DungeonLayout layout,
            Long originalRoomId,
            List<Room> fragments
    ) {
        if (traversal == null
                || layout == null
                || originalRoomId == null
                || fragments == null
                || fragments.isEmpty()
                || !traversal.connectsRoom(originalRoomId)) {
            return null;
        }
        List<Point2i> connectedRoomCenters = connectedRoomCenters(traversal, layout, originalRoomId);
        Room bestFragment = null;
        SplitFragmentScore bestScore = null;
        for (Room fragment : fragments) {
            if (fragment == null || fragment.roomId() == null) {
                continue;
            }
            SplitFragmentScore score = splitFragmentScore(fragment, connectedRoomCenters);
            if (bestScore == null || score.compareTo(bestScore) < 0) {
                bestFragment = fragment;
                bestScore = score;
            }
        }
        return bestFragment == null ? null : bestFragment.roomId();
    }

    private static List<Point2i> connectedRoomCenters(
            Traversal traversal,
            DungeonLayout layout,
            Long originalRoomId
    ) {
        ArrayList<Point2i> connectedRoomCenters = new ArrayList<>();
        for (Long roomId : traversal.roomIds()) {
            if (Objects.equals(roomId, originalRoomId)) {
                continue;
            }
            Room room = layout.findRoom(roomId);
            if (room != null) {
                connectedRoomCenters.add(room.floor().shape().centerCell());
            }
        }
        return connectedRoomCenters.isEmpty() ? List.of() : List.copyOf(connectedRoomCenters);
    }

    private static SplitFragmentScore splitFragmentScore(Room fragment, List<Point2i> connectedRoomCenters) {
        Point2i fragmentCenter = fragment.floor().shape().centerCell();
        int nearestRoomDistance = connectedRoomCenters.stream()
                .filter(Objects::nonNull)
                .mapToInt(fragmentCenter::distanceTo)
                .min()
                .orElse(Integer.MAX_VALUE);
        int groupDistance = connectedRoomCenters.stream()
                .filter(Objects::nonNull)
                .mapToInt(fragmentCenter::distanceTo)
                .sum();
        return new SplitFragmentScore(nearestRoomDistance, groupDistance);
    }

    private static Long mergedReplacementRoomId(ClusterRewrite rewrite) {
        Set<Long> replacementIds = rewrite.replacedRoomIds().entrySet().stream()
                .filter(entry -> rewrite.mergedRoomIds().contains(entry.getKey()))
                .map(Map.Entry::getValue)
                .filter(Objects::nonNull)
                .collect(LinkedHashSet::new, Set::add, Set::addAll);
        return replacementIds.size() == 1 ? replacementIds.iterator().next() : null;
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
            Room room = layout.findRoom(roomId);
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

    private static TraversalRoute requireExplicitRoute(
            DungeonLayout previousLayout,
            Traversal traversal,
            TraversalRoute traversalRoute
    ) {
        if (requiresExplicitRoute(previousLayout, traversal) && traversalRoute == null) {
            throw new IllegalArgumentException(
                    "Traversal " + traversal.traversalId() + " requires an explicit route before persistence");
        }
        return traversalRoute == null ? TraversalRoute.empty() : traversalRoute;
    }

    private static boolean requiresExplicitRoute(DungeonLayout previousLayout, Traversal traversal) {
        return previousLayout != null
                && traversal != null
                && traversal.traversalId() != null
                && traversal.isPersistable();
    }

    private record SplitFragmentScore(int nearestRoomDistance, int groupDistance) implements Comparable<SplitFragmentScore> {
        @Override
        public int compareTo(SplitFragmentScore other) {
            int nearestCompare = Integer.compare(nearestRoomDistance, other.nearestRoomDistance);
            if (nearestCompare != 0) {
                return nearestCompare;
            }
            return Integer.compare(groupDistance, other.groupDistance);
        }
    }
}
