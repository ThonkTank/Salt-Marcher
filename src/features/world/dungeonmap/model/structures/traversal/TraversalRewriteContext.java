package features.world.dungeonmap.model.structures.traversal;

import java.util.Objects;
import java.util.Set;

public record TraversalRewriteContext(
        TraversalPlanningInput previousPlanningInput,
        TraversalPlanningInput rewrittenPlanningInput,
        Set<Long> affectedTraversalIds,
        Set<Long> deletedClusterIds
) {
    public TraversalRewriteContext {
        previousPlanningInput = Objects.requireNonNull(previousPlanningInput, "previousPlanningInput");
        rewrittenPlanningInput = Objects.requireNonNull(rewrittenPlanningInput, "rewrittenPlanningInput");
        affectedTraversalIds = affectedTraversalIds == null ? Set.of() : Set.copyOf(affectedTraversalIds);
        deletedClusterIds = deletedClusterIds == null ? Set.of() : Set.copyOf(deletedClusterIds);
    }

    public boolean affects(Long traversalId) {
        return traversalId != null && affectedTraversalIds.contains(traversalId);
    }
}
