package features.world.dungeonmap.application.traversal;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.traversal.Traversal;
import features.world.dungeonmap.model.structures.traversal.TraversalPlan;
import features.world.dungeonmap.model.structures.traversal.TraversalSegmentIds;
import features.world.dungeonmap.model.structures.traversal.TraversalSegmentIdentityMatcher;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.Map;
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
        TraversalSegmentIds existingIds = segmentIds(previousLayout, traversal.traversalId());
        TraversalPlan resolvedPlan = TraversalSegmentIdentityMatcher.preserveSegmentIds(
                traversal,
                traversalPlan,
                existingIds,
                previousLayout);
        corridorReconciliation.reconcile(conn, traversal, resolvedPlan.corridorSlices(), existingIds);
        stairReconciliation.reconcile(conn, traversal, resolvedPlan.stairSlices(), existingIds);
    }

    private static TraversalSegmentIds segmentIds(DungeonLayout previousLayout, Long traversalId) {
        if (previousLayout == null || traversalId == null) {
            return TraversalSegmentIds.empty();
        }
        TraversalSegmentIds existingIds = previousLayout.traversalSegmentIds(traversalId);
        if (!existingIds.corridorIdsBySegmentKey().isEmpty() || !existingIds.stairIdsBySegmentKey().isEmpty()) {
            return existingIds;
        }
        LinkedHashMap<String, Long> corridorIds = new LinkedHashMap<>();
        for (var corridor : previousLayout.corridors()) {
            if (corridor != null && Objects.equals(corridor.traversalId(), traversalId)) {
                corridorIds.put(corridor.segmentKey(), corridor.corridorId());
            }
        }
        return new TraversalSegmentIds(corridorIds, Map.of());
    }
}
