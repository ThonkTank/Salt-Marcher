package features.world.dungeonmap.canvas.base;

import features.world.dungeonmap.application.runtime.DungeonRuntimeNavigationSnapshot;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;

import java.util.List;

public record DungeonRuntimeRenderOverlay(
        DungeonRuntimeNavigationSnapshot navigation,
        List<DungeonDoorNumberOverlay> doorNumbers
) {
    public DungeonRuntimeRenderOverlay {
        navigation = navigation == null ? DungeonRuntimeNavigationSnapshot.empty() : navigation;
        doorNumbers = doorNumbers == null ? List.of() : List.copyOf(doorNumbers);
    }

    public CellCoord activeCell() {
        return navigation.cell();
    }

    public int activeLevelZ() {
        return navigation.levelZ();
    }

    public CardinalDirection heading() {
        return navigation.heading();
    }

    public static DungeonRuntimeRenderOverlay empty() {
        return new DungeonRuntimeRenderOverlay(DungeonRuntimeNavigationSnapshot.empty(), List.of());
    }
}
