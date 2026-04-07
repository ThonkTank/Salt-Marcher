package features.world.dungeon.canvas.base;

import features.world.dungeon.application.runtime.DungeonRuntimeNavigationSnapshot;
import features.world.dungeon.application.runtime.description.DungeonRuntimeDescription;
import features.world.dungeon.dungoenmap.structure.model.boundary.door.DoorRef;

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
            DungeonRuntimeDescription description
    ) {
        List<ExitMarker> exitMarkers = description == null
                ? List.of()
                : description.exits().stream()
                        .map(exit -> new ExitMarker(exit.number(), exit.doorRef()))
                        .toList();
        return new DungeonRuntimeRenderOverlay(navigation, exitMarkers);
    }

    public static DungeonRuntimeRenderOverlay empty() {
        return new DungeonRuntimeRenderOverlay(DungeonRuntimeNavigationSnapshot.empty(), List.of());
    }

    public record ExitMarker(
            int number,
            DoorRef doorRef
    ) {
        public ExitMarker {
            number = number <= 0 ? 1 : number;
        }
    }
}
