package features.world.dungeonmap.application.runtime;

import java.util.List;

public record DungeonRuntimeNavigationSnapshot(
        DungeonRuntimeLocation activeLocation,
        List<Long> reachableRoomIds
) {
    public DungeonRuntimeNavigationSnapshot {
        reachableRoomIds = reachableRoomIds == null ? List.of() : List.copyOf(reachableRoomIds);
    }

    public static DungeonRuntimeNavigationSnapshot empty() {
        return new DungeonRuntimeNavigationSnapshot(null, List.of());
    }
}
