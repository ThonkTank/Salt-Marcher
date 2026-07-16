package features.dungeon.application.editor;

import static features.dungeon.application.editor.InterpretDungeonEditorMainViewInputUseCase.PointerAction.DRAG;
import static features.dungeon.application.editor.InterpretDungeonEditorMainViewInputUseCase.PointerAction.HOVER;
import static features.dungeon.application.editor.InterpretDungeonEditorMainViewInputUseCase.PointerAction.PRESS;
import static features.dungeon.application.editor.InterpretDungeonEditorMainViewInputUseCase.PointerAction.RELEASE;

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
