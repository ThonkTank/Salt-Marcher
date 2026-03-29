package features.world.dungeonmap.model.structures.traversal;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.stair.StairGeometry;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class TraversalReadModelProjector {

    private TraversalReadModelProjector() {
        throw new AssertionError("No instances");
    }

    public static List<Corridor> projectCorridors(
            long mapId,
            List<Traversal> traversals,
            TraversalPlanningInput planningInput
    ) {
        return project(mapId, traversals, planningInput, Map.of(), Map.of()).corridors();
    }

    public static TraversalReadModelProjection project(
            long mapId,
            List<Traversal> traversals,
            TraversalPlanningInput planningInput,
            Map<Long, TraversalPlan> traversalPlansByTraversalId,
            Map<String, String> stairNamesBySegmentKey
    ) {
        ArrayList<Corridor> corridors = new ArrayList<>();
        ArrayList<DungeonStair> stairs = new ArrayList<>();
        for (Traversal traversal : traversals == null ? List.<Traversal>of() : traversals) {
            if (traversal == null) {
                continue;
            }
            TraversalPlan traversalPlan = traversalPlan(traversal, planningInput, traversalPlansByTraversalId);
            for (CorridorTraversalSlice corridorSlice : traversalPlan
                    .withCorridorIds(traversal.materialization().corridorIdsBySegmentKey())
                    .corridorSlices()) {
                corridors.add(Corridor.resolved(
                        corridorSlice.segmentKey(),
                        corridorSlice.corridorId(),
                        traversal.traversalId(),
                        mapId,
                        traversal.roomIds(),
                        traversal.bindings(),
                        corridorSlice.path(),
                        corridorSlice.connections()));
            }
            for (TraversalStairSlice stairSlice : traversalPlan
                    .withStairIds(traversal.materialization().stairIdsBySegmentKey())
                    .stairSlices()) {
                DungeonStair stair = materializeStair(
                        stairSlice,
                        traversal.traversalId(),
                        mapId,
                        stairNamesBySegmentKey.get(stairSlice.segmentKey()));
                if (stair != null) {
                    stairs.add(stair);
                }
            }
        }
        return new TraversalReadModelProjection(List.copyOf(corridors), List.copyOf(stairs));
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

    private static DungeonStair materializeStair(
            TraversalStairSlice stairSlice,
            Long traversalId,
            long mapId,
            String stairName
    ) {
        if (stairSlice == null || stairSlice.placement() == null) {
            return null;
        }
        try {
            StairGeometry geometry = StairGeometry.fromExitLevels(
                    stairSlice.placement().shape(),
                    stairSlice.placement().anchor(),
                    stairSlice.placement().direction(),
                    stairSlice.placement().dimension1(),
                    stairSlice.placement().dimension2(),
                    stairSlice.placement().exitLevels());
            return new DungeonStair(
                    stairSlice.stairId(),
                    traversalId,
                    stairSlice.segmentKey(),
                    mapId,
                    stairName,
                    stairSlice.placement().shape(),
                    stairSlice.placement().direction() == null
                            ? CardinalDirection.defaultDirection()
                            : stairSlice.placement().direction(),
                    stairSlice.placement().dimension1(),
                    stairSlice.placement().dimension2(),
                    geometry.pathNodes(),
                    geometry.exits());
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }
}
