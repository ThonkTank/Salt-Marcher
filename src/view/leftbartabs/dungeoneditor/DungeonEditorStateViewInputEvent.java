package src.view.leftbartabs.dungeoneditor;

import java.util.List;

public record DungeonEditorStateViewInputEvent(
        long roomId,
        String visualDescription,
        List<String> exitDescriptions,
        boolean saveRequested
) {

    public DungeonEditorStateViewInputEvent {
        visualDescription = visualDescription == null ? "" : visualDescription;
        exitDescriptions = exitDescriptions == null
                ? List.of()
                : List.copyOf(exitDescriptions.stream()
                        .map(description -> description == null ? "" : description)
                        .toList());
    }
}
