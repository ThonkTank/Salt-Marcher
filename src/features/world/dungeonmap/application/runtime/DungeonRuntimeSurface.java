package features.world.dungeonmap.application.runtime;

import features.world.dungeonmap.model.geometry.GridSegment2x;
import ui.shell.DetailsNavigator;

import java.util.List;

public record DungeonRuntimeSurface(
        String title,
        DetailsNavigator.EntryKey entryKey,
        String visualDescription,
        List<DoorInfo> doors,
        List<DungeonRuntimeAction> actions
) {
    public DungeonRuntimeSurface {
        title = title == null || title.isBlank() ? "Dungeon" : title;
        visualDescription = visualDescription == null ? "" : visualDescription.trim();
        doors = doors == null ? List.of() : List.copyOf(doors);
        actions = actions == null ? List.of() : List.copyOf(actions);
    }

    public record DoorInfo(
            int number,
            GridSegment2x anchorSegment2x,
            String destinationLabel,
            String description
    ) {
        public DoorInfo {
            number = number <= 0 ? 1 : number;
            destinationLabel = destinationLabel == null ? "" : destinationLabel.trim();
            description = description == null ? "" : description.trim();
        }
    }
}
