package features.world.dungeonmap.model.structures.traversal.planning;

import features.world.dungeonmap.model.objects.CorridorPath;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorRewriteContext;
import features.world.dungeonmap.model.structures.corridor.planning.CorridorPlan;
import features.world.dungeonmap.model.structures.corridor.planning.StairPlacement;
import features.world.dungeonmap.model.structures.traversal.CorridorTraversalSlice;
import features.world.dungeonmap.model.structures.traversal.TraversalPlan;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class TraversalRewriteEngine {

    private TraversalRewriteEngine() {
        throw new AssertionError("No instances");
    }

    public static Corridor.RewriteResult rewriteAll(
            Map<Long, Corridor> corridorsById,
            CorridorRewriteContext context
    ) {
        if (corridorsById == null || corridorsById.isEmpty()) {
            return new Corridor.RewriteResult(Map.of(), Set.of(), Map.of());
        }
        if (context == null || context.affectedCorridorIds().isEmpty()) {
            return new Corridor.RewriteResult(Map.copyOf(corridorsById), Set.of(), Map.of());
        }
        Map<Long, Corridor> result = new LinkedHashMap<>();
        Map<Long, List<StairPlacement>> stairPlacementsByCorridorId = new LinkedHashMap<>();
        for (Map.Entry<Long, Corridor> entry : corridorsById.entrySet()) {
            Corridor corridor = entry.getValue();
            if (corridor == null) {
                result.put(entry.getKey(), null);
                continue;
            }
            Corridor reanchored = corridor.reanchoredFor(context);
            if (context.affects(corridor.corridorId()) && reanchored.isPersistable()) {
                TraversalPlan traversalPlan = TraversalPlanningEngine.plan(
                        TraversalPlanRequestProjector.project(reanchored, context.rewrittenPlanningInput()));
                CorridorTraversalSlice slice = traversalPlan.corridorSlice(reanchored.corridorId());
                CorridorPlan corridorPlan = new CorridorPlan(
                        slice == null ? CorridorPath.empty() : slice.path(),
                        slice == null ? List.of() : slice.connections(),
                        traversalPlan.stairPlacements());
                result.put(entry.getKey(), reanchored.applyPlan(corridorPlan));
                if (!traversalPlan.stairPlacements().isEmpty() && reanchored.corridorId() != null) {
                    stairPlacementsByCorridorId.put(reanchored.corridorId(), traversalPlan.stairPlacements());
                }
            } else {
                result.put(entry.getKey(), reanchored.replannedFor(context));
            }
        }
        return new Corridor.RewriteResult(
                Map.copyOf(result),
                context.affectedCorridorIds(),
                Map.copyOf(stairPlacementsByCorridorId));
    }
}
