package features.world.dungeonmap.model.structures.corridor.planning;

import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorPlanningInput;
import features.world.dungeonmap.model.structures.traversal.CorridorTraversalSlice;
import features.world.dungeonmap.model.structures.traversal.TraversalPlan;
import features.world.dungeonmap.model.structures.traversal.planning.TraversalPlanRequestProjector;
import features.world.dungeonmap.model.structures.traversal.planning.TraversalPlanningEngine;

public final class CorridorPlanningEngine {

    private CorridorPlanningEngine() {
        throw new AssertionError("No instances");
    }

    public static CorridorPlan plan(Corridor corridor, CorridorPlanningInput input) {
        TraversalPlan traversalPlan = planTraversal(corridor, input);
        CorridorTraversalSlice slice = corridorSlice(corridor, traversalPlan);
        return new CorridorPlan(
                slice == null ? null : slice.path(),
                slice == null ? null : slice.connections(),
                traversalPlan.stairPlacements());
    }

    public static CorridorTraversalSlice planTraversalSlice(Corridor corridor, CorridorPlanningInput input) {
        return corridorSlice(corridor, planTraversal(corridor, input));
    }

    private static TraversalPlan planTraversal(Corridor corridor, CorridorPlanningInput input) {
        return TraversalPlanningEngine.plan(TraversalPlanRequestProjector.project(corridor, input));
    }

    private static CorridorTraversalSlice corridorSlice(Corridor corridor, TraversalPlan traversalPlan) {
        Long corridorId = corridor == null ? null : corridor.corridorId();
        if (traversalPlan == null) {
            return new CorridorTraversalSlice(corridorId, null, null);
        }
        CorridorTraversalSlice slice = traversalPlan.corridorSlice(corridorId);
        return slice == null ? new CorridorTraversalSlice(corridorId, null, null) : slice;
    }
}
