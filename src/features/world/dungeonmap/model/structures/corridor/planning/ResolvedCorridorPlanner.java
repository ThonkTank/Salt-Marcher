package features.world.dungeonmap.model.structures.corridor.planning;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.corridor.ResolvedCorridorDoorBinding;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.traversal.CorridorTraversalSlice;
import features.world.dungeonmap.model.structures.traversal.TraversalPlan;
import features.world.dungeonmap.model.structures.traversal.TraversalRoomAnchor;
import features.world.dungeonmap.model.structures.traversal.planning.TraversalPlanRequest;
import features.world.dungeonmap.model.structures.traversal.planning.TraversalPlanningEngine;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class ResolvedCorridorPlanner {

    private ResolvedCorridorPlanner() {
        throw new AssertionError("No instances");
    }

    public static CorridorPlan planResolved(
            Long corridorId,
            long mapId,
            List<Room> rooms,
            Map<Long, Point2i> anchorCellsByRoomId,
            List<CubePoint> waypointCells,
            Map<Long, ResolvedCorridorDoorBinding> doorBindings,
            Set<CubePoint> obstacles
    ) {
        TraversalPlan traversalPlan = TraversalPlanningEngine.plan(new TraversalPlanRequest(
                corridorId,
                mapId,
                projectRoomAnchors(rooms),
                waypointCells,
                doorBindings,
                obstacles));
        CorridorTraversalSlice slice = traversalPlan.corridorSlice(corridorId);
        return new CorridorPlan(
                slice == null ? null : slice.path(),
                slice == null ? List.of() : slice.connections(),
                traversalPlan.stairPlacements());
    }

    private static List<TraversalRoomAnchor> projectRoomAnchors(List<Room> rooms) {
        if (rooms == null || rooms.isEmpty()) {
            return List.of();
        }
        ArrayList<TraversalRoomAnchor> result = new ArrayList<>();
        for (Room room : rooms) {
            TraversalRoomAnchor roomAnchor = TraversalRoomAnchor.from(room);
            if (roomAnchor != null) {
                result.add(roomAnchor);
            }
        }
        return result.isEmpty() ? List.of() : List.copyOf(result);
    }
}
