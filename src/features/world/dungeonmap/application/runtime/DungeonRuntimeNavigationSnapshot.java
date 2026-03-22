package features.world.dungeonmap.application.runtime;

public record DungeonRuntimeNavigationSnapshot(DungeonRuntimeLocation activeLocation) {

    public static DungeonRuntimeNavigationSnapshot empty() {
        return new DungeonRuntimeNavigationSnapshot(null);
    }
}
