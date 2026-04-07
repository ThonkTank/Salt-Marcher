package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.map.model.DungeonLayout;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;

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
}
