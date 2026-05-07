package src.view.leftbartabs.dungeoneditor;

import java.util.List;

record DungeonEditorStateProjection(
        String stateText,
        String statusText,
        boolean busy,
        List<DungeonEditorRoomNarrationCardProjection> narrationCards
) {
    DungeonEditorStateProjection {
        stateText = stateText == null ? "" : stateText;
        statusText = statusText == null ? "" : statusText;
        narrationCards = narrationCards == null ? List.of() : List.copyOf(narrationCards);
    }

    static DungeonEditorStateProjection initial() {
        return new DungeonEditorStateProjection("", "", false, List.of());
    }
}

record DungeonEditorRoomNarrationCardProjection(
        long roomId,
        String roomName,
        String visualDescription,
        List<DungeonEditorRoomExitNarrationProjection> exits
) {
    DungeonEditorRoomNarrationCardProjection {
        roomName = roomName == null || roomName.isBlank() ? "Raum" : roomName;
        visualDescription = visualDescription == null ? "" : visualDescription;
        exits = exits == null ? List.of() : List.copyOf(exits);
    }
}

record DungeonEditorRoomExitNarrationProjection(
        String label,
        int q,
        int r,
        int level,
        String direction,
        String description
) {
    DungeonEditorRoomExitNarrationProjection {
        label = label == null || label.isBlank() ? "Ausgang" : label;
        direction = direction == null || direction.isBlank() ? "NORTH" : direction;
        description = description == null ? "" : description;
    }
}
