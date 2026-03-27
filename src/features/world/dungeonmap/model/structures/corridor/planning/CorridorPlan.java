package features.world.dungeonmap.model.structures.corridor.planning;

import features.world.dungeonmap.model.objects.CorridorPath;
import features.world.dungeonmap.model.structures.connection.CorridorConnection;
import features.world.dungeonmap.model.structures.traversal.CorridorTraversalSlice;

import java.util.List;

/**
 * Legacy corridor-planning shim.
 *
 * <p>Corridor-local application now consumes {@link CorridorTraversalSlice}. This record remains only for callers
 * that still need stair placements alongside the corridor slice.</p>
 */
public record CorridorPlan(
        CorridorPath path,
        List<CorridorConnection> connections,
        List<StairPlacement> stairPlacements
) {
    public CorridorPlan {
        path = path == null ? CorridorPath.empty() : path;
        connections = connections == null ? List.of() : List.copyOf(connections);
        stairPlacements = stairPlacements == null ? List.of() : List.copyOf(stairPlacements);
    }

    public CorridorTraversalSlice asTraversalSlice(Long corridorId) {
        return new CorridorTraversalSlice(corridorId, path, connections);
    }
}
