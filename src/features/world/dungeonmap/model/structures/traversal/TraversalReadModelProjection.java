package features.world.dungeonmap.model.structures.traversal;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.stair.DungeonStair;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public record TraversalReadModelProjection(
        List<Corridor> corridors,
        List<DungeonStair> stairs
) {
    public TraversalReadModelProjection {
        corridors = corridors == null ? List.of() : List.copyOf(corridors);
        stairs = stairs == null ? List.of() : List.copyOf(stairs);
    }

    public static List<Corridor> projectCorridors(
            long mapId,
            List<Traversal> traversals,
            TraversalRoutingSnapshot routingSnapshot
    ) {
        return project(mapId, traversals, routingSnapshot, Map.of(), null).corridors();
    }

    public static TraversalReadModelProjection project(
            long mapId,
            List<Traversal> traversals,
            TraversalRoutingSnapshot routingSnapshot,
            Map<Long, TraversalRoute> traversalRoutesByTraversalId
    ) {
        return project(mapId, traversals, routingSnapshot, traversalRoutesByTraversalId, null);
    }

    public static TraversalReadModelProjection project(
            long mapId,
            List<Traversal> traversals,
            TraversalRoutingSnapshot routingSnapshot,
            Map<Long, TraversalRoute> traversalRoutesByTraversalId,
            DungeonLayout previousLayout
    ) {
        ArrayList<Corridor> projectedCorridors = new ArrayList<>();
        ArrayList<DungeonStair> projectedStairs = new ArrayList<>();
        for (Traversal traversal : traversals == null ? List.<Traversal>of() : traversals) {
            if (traversal == null) {
                continue;
            }
            TraversalRoute resolvedRoute = applySegmentRefs(
                    traversal,
                    traversalRoute(traversal, routingSnapshot, traversalRoutesByTraversalId));
            for (TraversalRoute.CorridorSegment corridorSegment : resolvedRoute.corridorSegments()) {
                Corridor corridor = corridorSegment == null ? null : corridorSegment.corridor();
                if (corridor != null) {
                    projectedCorridors.add(corridor);
                }
            }
            for (TraversalRoute.StairSegment stairSegment : resolvedRoute.stairSegments()) {
                DungeonStair stair = stairSegment == null ? null : stairSegment.stair();
                if (stair != null) {
                    projectedStairs.add(stair);
                }
            }
        }
        return new TraversalReadModelProjection(List.copyOf(projectedCorridors), List.copyOf(projectedStairs));
    }

    private static TraversalRoute traversalRoute(
            Traversal traversal,
            TraversalRoutingSnapshot routingSnapshot,
            Map<Long, TraversalRoute> traversalRoutesByTraversalId
    ) {
        if (traversal != null
                && traversal.traversalId() != null
                && traversalRoutesByTraversalId != null
                && traversalRoutesByTraversalId.containsKey(traversal.traversalId())) {
            return traversalRoutesByTraversalId.get(traversal.traversalId());
        }
        if (routingSnapshot == null) {
            return TraversalRoute.empty();
        }
        return traversal.route(routingSnapshot);
    }

    private static TraversalRoute applySegmentRefs(Traversal traversal, TraversalRoute traversalRoute) {
        if (traversal == null || traversalRoute == null) {
            return traversalRoute == null ? TraversalRoute.empty() : traversalRoute;
        }
        return traversalRoute
                .withCorridorIds(traversal.segmentRefs().corridorIdsBySegmentKey())
                .withStairIds(traversal.segmentRefs().stairIdsBySegmentKey());
    }
}
