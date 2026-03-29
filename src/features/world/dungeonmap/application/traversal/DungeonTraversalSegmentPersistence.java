package features.world.dungeonmap.application.traversal;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.traversal.Traversal;
import features.world.dungeonmap.model.structures.traversal.TraversalPlan;
import features.world.dungeonmap.model.structures.traversal.TraversalSegmentIdentityMatcher;
import features.world.dungeonmap.model.structures.traversal.TraversalSegmentRef;
import features.world.dungeonmap.model.structures.traversal.TraversalSegmentRefs;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.Objects;

public final class DungeonTraversalSegmentPersistence {

    private final DungeonCorridorReconciliation corridorReconciliation;
    private final DungeonStairReconciliation stairReconciliation;

    public DungeonTraversalSegmentPersistence(
            DungeonCorridorReconciliation corridorReconciliation,
            DungeonStairReconciliation stairReconciliation
    ) {
        this.corridorReconciliation = Objects.requireNonNull(corridorReconciliation, "corridorReconciliation");
        this.stairReconciliation = Objects.requireNonNull(stairReconciliation, "stairReconciliation");
    }

    public void persistSegments(
            Connection conn,
            DungeonLayout previousLayout,
            Traversal traversal,
            TraversalPlan traversalPlan
    ) throws SQLException {
        if (traversal == null || traversal.traversalId() == null) {
            return;
        }
        TraversalSegmentRefs existingRefs = existingRefs(previousLayout, traversal);
        TraversalPlan resolvedPlan = TraversalSegmentIdentityMatcher.preserveSegmentIds(
                traversal,
                traversalPlan,
                previousLayout);
        corridorReconciliation.reconcile(conn, traversal, resolvedPlan.corridorSlices(), existingRefs);
        stairReconciliation.reconcile(conn, traversal, resolvedPlan.stairSlices(), existingRefs);
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
        LinkedHashMap<String, TraversalSegmentRef> refsBySegmentKey = new LinkedHashMap<>();
        for (var corridor : previousLayout.corridors()) {
            if (corridor != null
                    && corridor.segmentKey() != null
                    && corridor.corridorId() != null
                    && Objects.equals(corridor.traversalId(), traversal.traversalId())) {
                refsBySegmentKey.put(corridor.segmentKey(), new TraversalSegmentRef.CorridorSegment(corridor.corridorId()));
            }
        }
        return refsBySegmentKey.isEmpty() ? TraversalSegmentRefs.empty() : new TraversalSegmentRefs(refsBySegmentKey);
    }
}
