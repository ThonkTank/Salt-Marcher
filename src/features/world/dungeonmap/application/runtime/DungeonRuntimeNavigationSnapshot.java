package features.world.dungeonmap.application.runtime;

public record DungeonRuntimeNavigationSnapshot(
        DungeonRuntimeLocation activeLocation,
        DungeonHeading heading
) {

    public static DungeonRuntimeNavigationSnapshot empty() {
        return new DungeonRuntimeNavigationSnapshot(null, DungeonHeading.defaultHeading());
    }
}
