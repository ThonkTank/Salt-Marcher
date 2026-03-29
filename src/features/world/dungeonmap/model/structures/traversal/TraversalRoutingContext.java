package features.world.dungeonmap.model.structures.traversal;

import java.util.Objects;
import java.util.Set;

public record TraversalRoutingContext(
        TraversalRoutingSnapshot previousSnapshot,
        TraversalRoutingSnapshot rewrittenSnapshot,
        Set<Long> affectedTraversalIds,
        Set<Long> deletedClusterIds
) {
    public TraversalRoutingContext {
        previousSnapshot = Objects.requireNonNull(previousSnapshot, "previousSnapshot");
        rewrittenSnapshot = Objects.requireNonNull(rewrittenSnapshot, "rewrittenSnapshot");
        affectedTraversalIds = affectedTraversalIds == null ? Set.of() : Set.copyOf(affectedTraversalIds);
        deletedClusterIds = deletedClusterIds == null ? Set.of() : Set.copyOf(deletedClusterIds);
    }

    public boolean affects(Long traversalId) {
        return traversalId != null && affectedTraversalIds.contains(traversalId);
    }
}
