package features.world.dungeon.shell.editor.interaction.tasks;

public final class ConnectionSurfaceSupport {

    private ConnectionSurfaceSupport() {
        throw new AssertionError("No instances");
    }

    public static boolean isExteriorRoomBoundary(
            features.world.dungeon.dungeonmap.model.DungeonMap layout,
            features.world.dungeon.model.interaction.DungeonSelectionRef.RoomBoundaryRef ref,
            int levelZ
    ) {
        features.world.dungeon.dungeonmap.api.RoomBoundaryDescription boundary =
                layout == null ? null : layout.describeRoomBoundary(ref, levelZ);
        return boundary != null && boundary.exterior();
    }

    public static boolean isAvailableCorridorBoundary(
            features.world.dungeon.dungeonmap.model.DungeonMap layout,
            features.world.dungeon.model.interaction.DungeonSelectionRef.CorridorBoundaryRef ref,
            int levelZ
    ) {
        return layout != null && ref != null && layout.describeCorridorBoundary(ref, levelZ) != null;
    }
}
