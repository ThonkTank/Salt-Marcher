package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.structures.connection.ConnectionEndpoint;
import features.world.dungeonmap.model.structures.transition.DungeonTransitionPlacement;

public final class ConnectionSurfaceSupport {

    private ConnectionSurfaceSupport() {
        throw new AssertionError("No instances");
    }

    public static boolean isExteriorRoomBoundary(
            DungeonLayout layout,
            DungeonSelectionRef.RoomBoundaryRef ref,
            int levelZ
    ) {
        DungeonLayout.RoomBoundaryDescription boundary = layout == null ? null : layout.describeRoomBoundary(ref, levelZ);
        return boundary != null && boundary.exterior();
    }

    public static boolean isAvailableCorridorBoundary(
            DungeonLayout layout,
            DungeonSelectionRef.CorridorBoundaryRef ref,
            int levelZ
    ) {
        return layout != null && ref != null && layout.describeCorridorBoundary(ref, levelZ) != null;
    }

    public static DungeonTransitionPlacement.DoorPlacement transitionDoorPlacement(
            DungeonLayout layout,
            DungeonSelectionRef ref,
            int levelZ
    ) {
        if (ref instanceof DungeonSelectionRef.RoomBoundaryRef roomBoundary
                && isExteriorRoomBoundary(layout, roomBoundary, levelZ)
                && roomBoundary.roomId() != null) {
            return new DungeonTransitionPlacement.DoorPlacement(
                    ConnectionEndpoint.room(roomBoundary.roomId()),
                    roomBoundary.boundarySegment2x(),
                    levelZ);
        }
        if (ref instanceof DungeonSelectionRef.CorridorBoundaryRef corridorBoundary
                && isAvailableCorridorBoundary(layout, corridorBoundary, levelZ)
                && corridorBoundary.corridorId() != null) {
            return new DungeonTransitionPlacement.DoorPlacement(
                    ConnectionEndpoint.corridor(corridorBoundary.corridorId()),
                    corridorBoundary.boundarySegment2x(),
                    levelZ);
        }
        return null;
    }
}
