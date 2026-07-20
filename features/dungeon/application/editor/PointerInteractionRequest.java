package features.dungeon.application.editor;

import features.dungeon.api.editor.DungeonEditorPointerGesture;
import features.dungeon.api.editor.DungeonEditorToolSelection;

public record PointerInteractionRequest(
        PointerAction action,
        DungeonEditorToolSelection toolSelection,
        DungeonEditorPointerGesture gesture,
        PointerInteractionTargets targets,
        int projectionLevel,
        TransitionDestination transitionDestination
) {
    public PointerInteractionRequest {
        toolSelection = toolSelection == null
                ? DungeonEditorToolSelection.select()
                : toolSelection;
        gesture = gesture == null ? DungeonEditorPointerGesture.none() : gesture;
        targets = targets == null ? PointerInteractionTargets.empty() : targets;
        transitionDestination = transitionDestination == null
                ? TransitionDestination.empty()
                : transitionDestination;
    }

}
