package src.features.dungeon.shell;

import java.util.Objects;
import src.domain.dungeon.DungeonEditorPointerApplicationService;
import src.domain.dungeon.published.ApplyDungeonEditorPointerCommand;
import src.domain.dungeon.published.MoveDungeonEditorHandleCommand;
import src.domain.dungeon.published.ShiftDungeonEditorProjectionLevelCommand;

record DungeonEditorLegacyPointerOperations(
        DungeonEditorPointerApplicationService pointerEditor
) {
    DungeonEditorLegacyPointerOperations {
        Objects.requireNonNull(pointerEditor, "pointerEditor");
    }

    void applyPointer(ApplyDungeonEditorPointerCommand command) {
        pointerEditor.applyPointer(command);
    }

    void scrollSelection(ShiftDungeonEditorProjectionLevelCommand command) {
        pointerEditor.scrollSelection(command);
    }

    void moveHandle(MoveDungeonEditorHandleCommand command) {
        pointerEditor.moveHandle(command);
    }
}
