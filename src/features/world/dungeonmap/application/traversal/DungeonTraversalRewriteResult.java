package features.world.dungeonmap.application.traversal;

import features.world.dungeonmap.model.structures.traversal.Traversal;
import features.world.dungeonmap.model.structures.traversal.TraversalRoute;

import java.util.Map;
import java.util.Set;

public record DungeonTraversalRewriteResult(
        Map<Long, Traversal> traversalsById,
        Set<Long> affectedTraversalIds,
        Map<Long, TraversalRoute> traversalRoutesByTraversalId
) {
    public DungeonTraversalRewriteResult {
        traversalsById = traversalsById == null ? Map.of() : Map.copyOf(traversalsById);
        affectedTraversalIds = affectedTraversalIds == null ? Set.of() : Set.copyOf(affectedTraversalIds);
        traversalRoutesByTraversalId = traversalRoutesByTraversalId == null
                ? Map.of()
                : Map.copyOf(traversalRoutesByTraversalId);
    }
}
