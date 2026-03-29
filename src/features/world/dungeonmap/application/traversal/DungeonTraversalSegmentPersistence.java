package features.world.dungeonmap.application.traversal;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.traversal.Traversal;
import features.world.dungeonmap.model.structures.traversal.TraversalRoute;
import features.world.dungeonmap.model.structures.traversal.TraversalSegmentIdentityMatcher;
import features.world.dungeonmap.model.structures.traversal.TraversalSegmentRefs;
import features.world.dungeonmap.persistence.DungeonCorridorWriteRepository;
import features.world.dungeonmap.persistence.DungeonStairWriteRepository;
import features.world.dungeonmap.persistence.DungeonTraversalCorridorSegmentWriteRepository;
import features.world.dungeonmap.persistence.DungeonTraversalStairSegmentWriteRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Objects;

public final class DungeonTraversalSegmentPersistence {

    private final DungeonCorridorReconciliation corridorReconciliation;
    private final DungeonStairReconciliation stairReconciliation;
    private final DungeonTraversalCorridorSegmentWriteRepository corridorSegmentWriteRepository;
    private final DungeonTraversalStairSegmentWriteRepository stairSegmentWriteRepository;
    private final DungeonCorridorWriteRepository corridorWriteRepository;
    private final DungeonStairWriteRepository stairWriteRepository;

    public DungeonTraversalSegmentPersistence(
            DungeonCorridorReconciliation corridorReconciliation,
            DungeonStairReconciliation stairReconciliation,
            DungeonTraversalCorridorSegmentWriteRepository corridorSegmentWriteRepository,
            DungeonTraversalStairSegmentWriteRepository stairSegmentWriteRepository,
            DungeonCorridorWriteRepository corridorWriteRepository,
            DungeonStairWriteRepository stairWriteRepository
    ) {
        this.corridorReconciliation = Objects.requireNonNull(corridorReconciliation, "corridorReconciliation");
        this.stairReconciliation = Objects.requireNonNull(stairReconciliation, "stairReconciliation");
        this.corridorSegmentWriteRepository = Objects.requireNonNull(corridorSegmentWriteRepository, "corridorSegmentWriteRepository");
        this.stairSegmentWriteRepository = Objects.requireNonNull(stairSegmentWriteRepository, "stairSegmentWriteRepository");
        this.corridorWriteRepository = Objects.requireNonNull(corridorWriteRepository, "corridorWriteRepository");
        this.stairWriteRepository = Objects.requireNonNull(stairWriteRepository, "stairWriteRepository");
    }

    public void persistSegments(
            Connection conn,
            DungeonLayout previousLayout,
            Traversal traversal,
            TraversalRoute traversalRoute
    ) throws SQLException {
        if (traversal == null || traversal.traversalId() == null) {
            return;
        }
        TraversalSegmentRefs existingRefs = existingRefs(previousLayout, traversal);
        TraversalRoute resolvedRoute = TraversalSegmentIdentityMatcher.preserveSegmentIds(
                traversal,
                traversalRoute,
                previousLayout);
        corridorReconciliation.reconcile(conn, traversal, resolvedRoute.corridorSegments(), existingRefs);
        stairReconciliation.reconcile(conn, traversal, resolvedRoute.stairSegments(), existingRefs);
    }

    public void deleteSegmentsForTraversal(Connection conn, long traversalId) throws SQLException {
        for (Long corridorId : corridorSegmentWriteRepository.deleteTraversalSegments(conn, traversalId)) {
            if (corridorId != null) {
                corridorWriteRepository.deleteCorridor(conn, corridorId);
            }
        }
        for (Long stairId : stairSegmentWriteRepository.deleteTraversalSegments(conn, traversalId)) {
            if (stairId != null) {
                stairWriteRepository.deleteStair(conn, stairId);
            }
        }
    }

    private static TraversalSegmentRefs existingRefs(DungeonLayout previousLayout, Traversal traversal) {
        if (traversal == null) {
            return TraversalSegmentRefs.empty();
        }
        if (!traversal.segmentRefs().refsBySegmentKey().isEmpty()) {
            return traversal.segmentRefs();
        }
        if (previousLayout == null || traversal.traversalId() == null) {
            return TraversalSegmentRefs.empty();
        }
        Traversal previousTraversal = previousLayout.findTraversal(traversal.traversalId());
        if (previousTraversal != null && !previousTraversal.segmentRefs().refsBySegmentKey().isEmpty()) {
            return previousTraversal.segmentRefs();
        }
        return TraversalSegmentRefs.empty();
    }
}
