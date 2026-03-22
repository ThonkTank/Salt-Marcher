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
        PlannerInstrumentation instrumentation = PlannerInstrumentation.createIfEnabled();
        long startedAt = instrumentation == null ? 0L : System.nanoTime();
        GridRoute route = resolvedRoute(corridor, input);
        try {
            if (corridor == null || input == null) {
                return CorridorPath.empty(route);
            }
            List<Room> rooms = corridor.resolvedRooms(input);
            if (rooms.size() < 2) {
                return CorridorPath.empty(route);
            }

            Map<Long, ResolvedCorridorDoorBinding> doorBindings = corridor.resolvedDoorBindings(input);
            List<Point2i> waypointCells = corridor.resolvedWaypointCells(input);
            PlannerContext context = new PlannerContext(rooms, waypointCells, doorBindings, instrumentation);
            MutableNetwork network = NetworkBuilder.bestNetwork(context, CONFIG);

            boolean routable = network.connectedRoomIds.size() == rooms.size()
                    && (!network.corridorCells.isEmpty() || !network.doors.isEmpty());
            return new CorridorPath(
                    route,
                    new Floor(TileShape.fromAbsoluteCells(network.corridorCells)),
                    List.copyOf(network.doors.values()),
                    network.directlyAdjacentOnly,
                    routable);
        } finally {
            if (instrumentation != null) {
                instrumentation.logSummary(System.nanoTime() - startedAt);
            }
        }
    }

    private static GridRoute resolvedRoute(Corridor corridor, CorridorPlanningInput input) {
        if (corridor == null || input == null) {
            return new GridRoute(List.of());
        }
        List<Room> rooms = corridor.resolvedRooms(input);
        List<GridAnchor> anchors = new ArrayList<>();
        List<Point2i> waypoints = corridor.resolvedWaypointCells(input);
        if (waypoints != null) {
            for (Point2i waypoint : waypoints) {
                if (waypoint != null) {
                    anchors.add(GridAnchor.atTile(waypoint));
                }
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
