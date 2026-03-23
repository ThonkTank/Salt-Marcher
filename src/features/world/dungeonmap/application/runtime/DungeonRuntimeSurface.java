package features.world.dungeonmap.application.runtime;

import ui.shell.DetailsNavigator;

import java.util.List;

public record DungeonRuntimeSurface(
        String title,
        DetailsNavigator.EntryKey entryKey,
        String visualDescription,
        List<DungeonRuntimeDoorDescriptor> doors,
        List<DungeonRuntimeStairDescriptor> stairs,
        List<DungeonRuntimeTransitionDescriptor> transitions
) {
    public DungeonRuntimeSurface {
        title = title == null || title.isBlank() ? "Dungeon" : title;
        visualDescription = visualDescription == null ? "" : visualDescription.trim();
        doors = doors == null ? List.of() : List.copyOf(doors);
        stairs = stairs == null ? List.of() : List.copyOf(stairs);
        transitions = transitions == null ? List.of() : List.copyOf(transitions);
    }
}
