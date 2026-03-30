package features.world.dungeonmap.application.traversal;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.cluster.ClusterRewrite;
import features.world.dungeonmap.model.structures.traversal.Traversal;
import features.world.dungeonmap.model.structures.traversal.TraversalRoute;
import features.world.dungeonmap.model.structures.traversal.TraversalRoutingContext;
import features.world.dungeonmap.model.structures.traversal.TraversalRoutingSnapshot;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class DungeonTraversalRewriteService {

    private final DungeonTraversalRoomRewriteService roomRewriteService;

    public DungeonTraversalRewriteService(DungeonTraversalRoomRewriteService roomRewriteService) {
        this.roomRewriteService = Objects.requireNonNull(roomRewriteService, "roomRewriteService");
    }

    public DungeonTraversalRewriteResult rewriteForClusterRewrite(
            DungeonLayout beforeLayout,
            Map<Long, Traversal> traversalsById,
            ClusterRewrite rewrite
    ) {
        if (beforeLayout == null || rewrite == null || rewrite.isNoOp()) {
            return unchanged(traversalsById);
        }
        Map<Long, Traversal> rewrittenTraversals = roomRewriteService.applyRoomRewrite(beforeLayout, traversalsById, rewrite);
        DungeonLayout rewrittenLayout = beforeLayout.applying(rewrite);
        return rewrite(
                beforeLayout,
                rewrittenLayout,
                rewrittenTraversals,
                beforeLayout.traversalIdsAffectedBy(rewrite),
                rewrite.deletedClusterIds());
    }

    public DungeonTraversalRewriteResult rewriteForLayoutChange(
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

    private static DungeonTraversalRewriteResult rewrite(
            DungeonLayout beforeLayout,
            DungeonLayout rewrittenLayout,
            Map<Long, Traversal> traversalsById,
            Set<Long> affectedTraversalIds,
            Set<Long> deletedClusterIds
    ) {
        Map<Long, Traversal> sourceTraversals = traversalsById == null ? Map.of() : Map.copyOf(traversalsById);
        if (sourceTraversals.isEmpty()) {
            return new DungeonTraversalRewriteResult(Map.of(), Set.of(), Map.of());
        }
        Set<Long> normalizedAffectedTraversalIds = affectedTraversalIds == null ? Set.of() : Set.copyOf(affectedTraversalIds);
        if (normalizedAffectedTraversalIds.isEmpty()) {
            return new DungeonTraversalRewriteResult(sourceTraversals, Set.of(), Map.of());
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
        return new DungeonTraversalRewriteResult(
                reanchoredTraversalsById,
                normalizedAffectedTraversalIds,
                traversalRoutesByTraversalId);
    }

    private static DungeonTraversalRewriteResult unchanged(Map<Long, Traversal> traversalsById) {
        return new DungeonTraversalRewriteResult(
                traversalsById == null ? Map.of() : Map.copyOf(traversalsById),
                Set.of(),
                Map.of());
    }
}
