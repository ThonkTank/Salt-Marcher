package features.world.dungeonmap.model.structures.corridor.planning;

import features.world.dungeonmap.model.geometry.GridAnchor;
import features.world.dungeonmap.model.geometry.GridRoute;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.objects.CorridorPath;
import features.world.dungeonmap.model.objects.Floor;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.corridor.CorridorPlanningInput;
import features.world.dungeonmap.model.structures.corridor.ResolvedCorridorDoorBinding;
import features.world.dungeonmap.model.structures.room.Room;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class CorridorPlanningEngine {

    private static final PlannerConfig CONFIG = new PlannerConfig(
            12,
            8,
            24,
            28,
            32);

    private CorridorPlanningEngine() {
        throw new AssertionError("No instances");
    }

    public static CorridorPath plan(Corridor corridor, CorridorPlanningInput input) {
        PlannerInstrumentation instrumentation = PlannerInstrumentation.create();
        long startedAt = instrumentation.startTimer();
        try {
            if (corridor == null || input == null) {
                return CorridorPath.unroutable(new GridRoute(List.of()));
            }
            List<Room> rooms = corridor.resolvedRooms(input);
            List<Point2i> waypointCells = corridor.resolvedWaypointCells(input);
            GridRoute route = buildRoute(rooms, waypointCells);
            if (rooms.size() < 2) {
                return CorridorPath.unroutable(route);
            }

            Map<Long, ResolvedCorridorDoorBinding> doorBindings = corridor.resolvedDoorBindings(input);
            PlannerContext context = new PlannerContext(rooms, waypointCells, doorBindings, instrumentation);
            MutableNetwork network = NetworkBuilder.bestNetwork(context, CONFIG);

            boolean routable = network.connectedRoomIds.size() == rooms.size()
                    && (!network.corridorCells.isEmpty() || !network.doorEdges.isEmpty());
            return new CorridorPath(
                    route,
                    new Floor(TileShape.fromAbsoluteCells(network.corridorCells)),
                    Set.copyOf(network.doorEdges),
                    network.directlyAdjacentOnly,
                    routable);
        } finally {
            instrumentation.logSummary(startedAt);
        }
    }

    private static GridRoute buildRoute(List<Room> rooms, List<Point2i> waypointCells) {
        List<GridAnchor> anchors = new ArrayList<>();
        for (Point2i waypoint : waypointCells) {
            if (waypoint != null) {
                anchors.add(GridAnchor.atTile(waypoint));
            }
        }
        if (anchors.isEmpty()) {
            for (Room room : rooms) {
                anchors.add(GridAnchor.atTile(room.floor().shape().centerCell()));
            }
        }
        return new GridRoute(anchors);
    }
}
