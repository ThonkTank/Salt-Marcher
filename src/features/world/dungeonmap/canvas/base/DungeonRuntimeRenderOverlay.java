package features.world.dungeonmap.canvas.base;

import features.world.dungeonmap.application.runtime.DungeonRuntimeNavigationSnapshot;

import java.util.List;

public record DungeonRuntimeRenderOverlay(
        DungeonRuntimeNavigationSnapshot navigation,
        List<DungeonDoorNumberOverlay> doorNumbers
) {
    public DungeonRuntimeRenderOverlay {
        navigation = navigation == null ? DungeonRuntimeNavigationSnapshot.empty() : navigation;
        doorNumbers = doorNumbers == null ? List.of() : List.copyOf(doorNumbers);
    }

    public static DungeonRuntimeRenderOverlay empty() {
        return new DungeonRuntimeRenderOverlay(DungeonRuntimeNavigationSnapshot.empty(), List.of());
    }
}
