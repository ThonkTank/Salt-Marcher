package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;

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
        if (boundary == null || !boundary.exterior() || boundary.clusterId() == null || boundary.room() == null) {
            return false;
        }
        RoomCluster cluster = layout.findCluster(boundary.clusterId());
        return cluster != null && cluster.roomOpeningEdgesAtLevel(boundary.room(), levelZ).contains(ref.boundarySegment2x());
    }

    public static boolean isAvailableCorridorBoundary(
            DungeonLayout layout,
            DungeonSelectionRef.CorridorBoundaryRef ref,
            int levelZ
    ) {
        return layout != null && ref != null && layout.describeCorridorBoundary(ref, levelZ) != null;
    }
}
