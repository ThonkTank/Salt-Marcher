package features.world.dungeonmap.application.runtime;

import ui.shell.DetailsNavigator;

import java.util.List;

public record DungeonRuntimeSurface(
        String title,
        DetailsNavigator.EntryKey entryKey,
        String visualDescription,
        List<DungeonRuntimeDoorDescriptor> doors
) {
    public DungeonRuntimeSurface {
        title = title == null || title.isBlank() ? "Dungeon" : title;
        visualDescription = visualDescription == null ? "" : visualDescription.trim();
        doors = doors == null ? List.of() : List.copyOf(doors);
    }
}
