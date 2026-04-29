package src.view.leftbartabs.dungeoneditor;

import java.util.List;

public record DungeonEditorStateViewInputEvent(
        long roomId,
        String visualDescription,
        List<RoomExitNarrationSnapshot> exits
) {

    public DungeonEditorStateViewInputEvent {
        visualDescription = visualDescription == null ? "" : visualDescription;
        exits = exits == null ? List.of() : List.copyOf(exits);
    }

    public record RoomExitNarrationSnapshot(
            String label,
            int q,
            int r,
            int level,
            String direction,
            String description
    ) {
        public RoomExitNarrationSnapshot {
            label = label == null ? "" : label;
            direction = direction == null ? "" : direction;
            description = description == null ? "" : description;
        }
    }
}
