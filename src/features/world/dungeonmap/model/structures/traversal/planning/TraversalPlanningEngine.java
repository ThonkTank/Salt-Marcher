package features.world.dungeonmap.model.structures.traversal.planning;

import features.world.dungeonmap.model.structures.traversal.TraversalPlan;
import features.world.dungeonmap.model.structures.traversal.planning.internal.TraversalGeometryRealizer;
import features.world.dungeonmap.model.structures.traversal.planning.internal.TraversalStructurePlanner;
import features.world.dungeonmap.model.structures.traversal.planning.internal.TraversalTopology;
import features.world.dungeonmap.model.structures.traversal.planning.internal.TraversalTopologyProjector;

public final class TraversalPlanningEngine {

    private TraversalPlanningEngine() {
        throw new AssertionError("No instances");
    }

    public static TraversalPlan plan(TraversalPlanRequest request) {
        if (request == null) {
            return TraversalPlan.empty();
        }
        TraversalTopology topology = TraversalTopologyProjector.project(request);
        TraversalStructurePlanner.StructurePlan structurePlan = TraversalStructurePlanner.plan(topology);
        return TraversalGeometryRealizer.realize(structurePlan);
    }
}
