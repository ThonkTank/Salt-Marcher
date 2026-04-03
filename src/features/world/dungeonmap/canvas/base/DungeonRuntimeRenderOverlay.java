package features.world.dungeonmap.canvas.base;

import features.world.dungeonmap.application.runtime.DungeonRuntimeNavigationSnapshot;
import features.world.dungeonmap.application.runtime.DungeonRuntimeSurface;
import features.world.dungeonmap.model.geometry.GridSegment2x;

import java.util.List;

public record DungeonRuntimeRenderOverlay(
        DungeonRuntimeNavigationSnapshot navigation,
        List<ExitMarker> exitMarkers
) {
    public DungeonRuntimeRenderOverlay {
        navigation = navigation == null ? DungeonRuntimeNavigationSnapshot.empty() : navigation;
        exitMarkers = exitMarkers == null ? List.of() : List.copyOf(exitMarkers);
    }

    public static DungeonRuntimeRenderOverlay from(
            DungeonRuntimeNavigationSnapshot navigation,
            DungeonRuntimeSurface surface
    ) {
        List<ExitMarker> exitMarkers = surface == null
                ? List.of()
                : surface.exits().stream()
                        .map(exit -> new ExitMarker(exit.number(), exit.anchorSegment2x()))
                        .toList();
        return new DungeonRuntimeRenderOverlay(navigation, exitMarkers);
    }

    public static DungeonRuntimeRenderOverlay empty() {
        return new DungeonRuntimeRenderOverlay(DungeonRuntimeNavigationSnapshot.empty(), List.of());
    }

    public record ExitMarker(
            int number,
            GridSegment2x anchorSegment2x
    ) {
        public ExitMarker {
            number = number <= 0 ? 1 : number;
        }
    }
}
