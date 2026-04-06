package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;

import java.util.Objects;

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

    public static boolean isExistingExteriorRoomDoor(
            DungeonLayout layout,
            DungeonSelectionRef.RoomBoundaryRef ref,
            int levelZ
    ) {
        if (layout == null || ref == null) {
            return false;
        }
        DungeonLayout.RoomBoundaryDescription boundary = layout.describeRoomBoundary(ref, levelZ);
        if (boundary == null || !boundary.exterior()) {
            return false;
        }
        DungeonLayout.DoorDescription description = layout.describeDoorAt(levelZ, ref.boundarySegment2x());
        return description != null
                && description.role() == DungeonLayout.DoorRole.ROOM_EXTERIOR
                && Objects.equals(description.roomId(), ref.roomId());
    }

    public static boolean isAvailableCorridorBoundary(
            DungeonLayout layout,
            DungeonSelectionRef.CorridorBoundaryRef ref,
            int levelZ
    ) {
        return layout != null && ref != null && layout.describeCorridorBoundary(ref, levelZ) != null;
    }
}
