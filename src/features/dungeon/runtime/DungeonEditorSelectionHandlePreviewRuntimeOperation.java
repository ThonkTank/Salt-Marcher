package src.features.dungeon.runtime;

import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerAction;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.PointerSample;
import src.features.dungeon.runtime.DungeonEditorRuntimeOperations.TransitionDestination;

final class DungeonEditorSelectionHandlePreviewRuntimeOperation {
    private final ApplyDungeonEditorSelectionUseCase selection;

    DungeonEditorSelectionHandlePreviewRuntimeOperation(
            ApplyDungeonEditorSelectionUseCase selection
    ) {
        this.selection = selection;
    }

    void apply(
            PointerAction action,
            PointerSample sample,
            boolean wallSingleClickMode,
            TransitionDestination transitionDestination
    ) {
        DungeonEditorMainViewInput input = DungeonEditorRuntimeInputTranslator.mainViewInput(
                sample,
                wallSingleClickMode,
                transitionDestination);
        PointerAction effectiveAction = previewAction(action);
        if (effectiveAction == PointerAction.PRESSED) {
            selection.press(input);
        } else if (effectiveAction == PointerAction.DRAGGED) {
            selection.drag(input);
        } else if (effectiveAction == PointerAction.RELEASED) {
            selection.release(input);
        } else if (effectiveAction == PointerAction.MOVED) {
            selection.hover(input);
        } else {
            throw new IllegalStateException("Unsupported selection pointer action: " + effectiveAction);
        }
    }

    private static PointerAction previewAction(PointerAction action) {
        return action == null ? PointerAction.MOVED : action;
    }
}
