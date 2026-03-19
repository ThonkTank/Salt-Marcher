package features.world.quarantine.dungeonmap.corridors.model.routing;

import features.world.quarantine.dungeonmap.corridors.model.binding.CorridorWaypoint;
import features.world.quarantine.dungeonmap.corridors.model.primitives.DoorSegment;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.corridors.model.topology.ResolvedDoorOverride;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public final class CorridorPlanningResolver {

    private CorridorPlanningResolver() {
        throw new AssertionError("No instances");
    }

    public static ResolvedDoorOverride resolveDoorOverride(DungeonLayout layout, DungeonCorridor corridor, DungeonRoom room) {
        if (layout == null || corridor == null || room == null || room.roomId() == null) {
            return null;
        }
        return corridor.doorOverrides().stream()
                .filter(override -> override.roomId() == room.roomId())
                .filter(override -> override.clusterId() == room.clusterId())
                .map(override -> {
                    DungeonRoomCluster cluster = layout.findCluster(override.clusterId());
                    if (cluster == null) {
                        return null;
                    }
                    return new ResolvedDoorOverride(override.absoluteCell(cluster.center()), override.edgeDirection());
                })
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);
    }

    public static boolean matchesOverride(DoorSegment door, ResolvedDoorOverride override) {
        if (override == null || door == null) {
            return true;
        }
        return door.roomCell().equals(override.absoluteCell())
                && CorridorRouteGeometry.directionForDoor(door).equals(override.edgeDirection().delta());
    }

    public static List<Point2i> resolveWaypointCells(DungeonLayout layout, DungeonCorridor corridor) {
        if (layout == null || corridor == null || corridor.waypoints().isEmpty()) {
            return List.of();
        }
        List<Point2i> result = new ArrayList<>();
        for (CorridorWaypoint waypoint : corridor.waypoints()) {
            DungeonRoomCluster cluster = layout.findCluster(waypoint.clusterId());
            if (cluster == null) {
                continue;
            }
            result.add(waypoint.absoluteCell(cluster.center()));
        }
        return List.copyOf(result);
    }
}
