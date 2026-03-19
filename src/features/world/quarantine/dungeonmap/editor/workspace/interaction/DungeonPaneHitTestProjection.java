package features.world.quarantine.dungeonmap.editor.workspace.interaction;

import features.world.quarantine.dungeonmap.corridors.model.primitives.DoorSegment;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridorEndpoint;
import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorGeometry;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.CorridorDoorHit;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.DungeonCorridorDoorProjector;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.foundation.geometry.ScreenPoint;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;

/**
 * Hit-testing and geometric projection capabilities of a dungeon pane.
 * <p>
 * Consumers that only need to resolve pointer positions to dungeon elements
 * can depend on this interface instead of the concrete {@link features.world.quarantine.dungeonmap.editor.workspace.pane.AbstractDungeonPane}.
 */
public interface DungeonPaneHitTestProjection {

    DungeonRoomCluster findClusterAt(ScreenPoint screen);

    DungeonRoom findRoomAt(ScreenPoint screen);

    DungeonCorridor findCorridorAt(ScreenPoint screen);

    CorridorDoorHit findCorridorDoorHitAt(ScreenPoint screen);

    double corridorDoorHitDistance(
            ScreenPoint screen,
            DungeonCorridor corridor,
            CorridorGeometry geometry,
            DoorSegment door
    );

    double selectedCorridorDoorHandleDistance(
            ScreenPoint screen,
            DungeonCorridorDoorProjector.CorridorSelectionContext context,
            DoorSegment door
    );

    double selectedCorridorWaypointHandleDistance(
            ScreenPoint screen,
            DungeonCorridorDoorProjector.CorridorSelectionContext context,
            Point2i waypoint
    );

    int corridorSegmentIndexAt(ScreenPoint screen);

    default DungeonCorridorEndpoint corridorEndpointLocationAt(
            ScreenPoint screen,
            DungeonRoom room,
            DungeonCorridor corridor
    ) {
        if (room != null && room.roomId() != null) {
            return DungeonCorridorEndpoint.room(room.roomId());
        }
        if (corridor != null && corridor.corridorId() != null) {
            return DungeonCorridorEndpoint.corridor(corridor.corridorId());
        }
        return null;
    }
}
