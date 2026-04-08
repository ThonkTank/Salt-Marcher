package features.world.dungeon.shell.editor.interaction;

import features.world.dungeon.dungeonmap.api.RoomBoundaryDescription;
import features.world.dungeon.dungeonmap.model.DungeonMap;
import features.world.dungeon.model.interaction.DungeonSelectionRef;

final class ConnectionSurfaceSupport {

    private ConnectionSurfaceSupport() {
        throw new AssertionError("No instances");
    }

    public static boolean isExteriorRoomBoundary(
            DungeonMap layout,
            DungeonSelectionRef.RoomBoundaryRef ref,
            int levelZ
    ) {
        RoomBoundaryDescription boundary = layout == null ? null : layout.describeRoomBoundary(ref, levelZ);
        return boundary != null && boundary.exterior();
    }

    public static boolean isAvailableCorridorBoundary(
            DungeonMap layout,
            DungeonSelectionRef.CorridorBoundaryRef ref,
            int levelZ
    ) {
        return layout != null && ref != null && layout.describeCorridorBoundary(ref, levelZ) != null;
    }
}
