package features.world.dungeonmap.model.structures.corridor;

import java.util.Objects;
import java.util.Set;

/**
 * Complete corridor rewrite context for a single topology rewrite step.
 */
public record CorridorRewriteContext(
        CorridorPlanningInput previousPlanningInput,
        CorridorPlanningInput rewrittenPlanningInput,
        Set<Long> affectedCorridorIds,
        Set<Long> deletedClusterIds
) {
    public CorridorRewriteContext {
        previousPlanningInput = Objects.requireNonNull(previousPlanningInput, "previousPlanningInput");
        rewrittenPlanningInput = Objects.requireNonNull(rewrittenPlanningInput, "rewrittenPlanningInput");
        affectedCorridorIds = affectedCorridorIds == null ? Set.of() : Set.copyOf(affectedCorridorIds);
        deletedClusterIds = deletedClusterIds == null ? Set.of() : Set.copyOf(deletedClusterIds);
    }

    public boolean affects(Long corridorId) {
        return corridorId != null && affectedCorridorIds.contains(corridorId);
    }
}
