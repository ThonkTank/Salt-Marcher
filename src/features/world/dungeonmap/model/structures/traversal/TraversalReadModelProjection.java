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
            TraversalPlanningInput planningInput,
            Map<Long, TraversalSegmentIds> segmentIdsByTraversalId
    ) {
        return project(mapId, traversals, planningInput, Map.of(), segmentIdsByTraversalId, null).corridors();
    }

    public static TraversalReadModelProjection project(
            long mapId,
            List<Traversal> traversals,
            TraversalPlanningInput planningInput,
            Map<Long, TraversalPlan> traversalPlansByTraversalId,
            Map<Long, TraversalSegmentIds> segmentIdsByTraversalId
    ) {
        return project(mapId, traversals, planningInput, traversalPlansByTraversalId, segmentIdsByTraversalId, null);
    }

    public static TraversalReadModelProjection project(
            long mapId,
            List<Traversal> traversals,
            TraversalPlanningInput planningInput,
            Map<Long, TraversalPlan> traversalPlansByTraversalId,
            Map<Long, TraversalSegmentIds> segmentIdsByTraversalId,
            DungeonLayout previousLayout
    ) {
        ArrayList<Corridor> projectedCorridors = new ArrayList<>();
        ArrayList<DungeonStair> projectedStairs = new ArrayList<>();
        for (Traversal traversal : traversals == null ? List.<Traversal>of() : traversals) {
            if (traversal == null) {
                continue;
            }
            TraversalPlan resolvedPlan = TraversalSegmentIdentityMatcher.preserveSegmentIds(
                    traversal,
                    traversalPlan(traversal, planningInput, traversalPlansByTraversalId),
                    traversal.traversalId() == null
                            ? TraversalSegmentIds.empty()
                            : segmentIdsByTraversalId.getOrDefault(traversal.traversalId(), TraversalSegmentIds.empty()),
                    previousLayout);
            for (CorridorTraversalSlice corridorSlice : resolvedPlan.corridorSlices()) {
                Corridor corridor = Corridor.fromTraversalSlice(
                        corridorSlice,
                        traversal.traversalId(),
                        mapId,
                        traversal.roomIds());
                if (corridor != null) {
                    projectedCorridors.add(corridor);
                }
            }
            for (TraversalStairSlice stairSlice : resolvedPlan.stairSlices()) {
                DungeonStair stair = DungeonStair.materialized(
                        stairSlice == null ? null : stairSlice.stair(),
                        stairSlice == null ? null : stairSlice.stairId(),
                        traversal.traversalId(),
                        mapId);
                if (stair != null) {
                    projectedStairs.add(stair);
                }
            }
        }
        return new TraversalReadModelProjection(List.copyOf(projectedCorridors), List.copyOf(projectedStairs));
    }

    private static TraversalPlan traversalPlan(
            Traversal traversal,
            TraversalPlanningInput planningInput,
            Map<Long, TraversalPlan> traversalPlansByTraversalId
    ) {
        if (traversal != null
                && traversal.traversalId() != null
                && traversalPlansByTraversalId != null
                && traversalPlansByTraversalId.containsKey(traversal.traversalId())) {
            return traversalPlansByTraversalId.get(traversal.traversalId());
        }
        if (planningInput == null) {
            return TraversalPlan.empty();
        }
        return features.world.dungeonmap.model.structures.traversal.planning.TraversalPlanningEngine.plan(traversal, planningInput);
    }
}
