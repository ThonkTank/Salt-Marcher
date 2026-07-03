package src.features.dungeon.runtime;

import static src.features.dungeon.runtime.InterpretDungeonEditorMainViewInputUseCase.PointerAction.DRAG;
import static src.features.dungeon.runtime.InterpretDungeonEditorMainViewInputUseCase.PointerAction.HOVER;
import static src.features.dungeon.runtime.InterpretDungeonEditorMainViewInputUseCase.PointerAction.PRESS;
import static src.features.dungeon.runtime.InterpretDungeonEditorMainViewInputUseCase.PointerAction.RELEASE;

final class DungeonEditorDraftOperationSupport {
    private DungeonEditorDraftOperationSupport() {
    }

    static PointerAction previewAction(PointerAction action) {
        return PointerAction.orMoved(action);
    }

    static InterpretDungeonEditorMainViewInputUseCase.PointerAction pointerAction(PointerAction action) {
        return switch (action) {
            case PRESSED -> PRESS;
            case DRAGGED -> DRAG;
            case RELEASED -> RELEASE;
            case MOVED -> HOVER;
        };
    }

}
