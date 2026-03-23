package features.world.dungeonmap.application.runtime;

public record DungeonRuntimeNavigationSnapshot(
        Long mapId,
        DungeonRuntimeLocation activeLocation,
        DungeonHeading heading
) {

    public static DungeonRuntimeNavigationSnapshot empty() {
        return new DungeonRuntimeNavigationSnapshot(null, null, DungeonHeading.defaultHeading());
    }
}
