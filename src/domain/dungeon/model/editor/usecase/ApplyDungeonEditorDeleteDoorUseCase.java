package src.domain.dungeon.model.editor.usecase;

import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.editor.usecase.BuildDungeonEditorMainViewInputUseCase.MainViewInput;

public final class ApplyDungeonEditorDeleteDoorUseCase {
    private final DungeonEditorApplyToolUseCase toolUseCase;

    public ApplyDungeonEditorDeleteDoorUseCase(
            DungeonEditorSessionWorkflow workflow,
            InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        this.toolUseCase = new DungeonEditorApplyToolUseCase(workflow, mainViewInterpreter, effectUseCase);
    }

    public void press(MainViewInput input) {
        toolUseCase.pressBoundary(input, DungeonEditorSessionValues.Tool.DOOR_DELETE);
    }

    public void drag(MainViewInput input) {
        toolUseCase.dragBoundary(input, DungeonEditorSessionValues.Tool.DOOR_DELETE);
    }

    public void release(MainViewInput input) {
        toolUseCase.releaseBoundary(input, DungeonEditorSessionValues.Tool.DOOR_DELETE);
    }

    public void hover(MainViewInput input) {
        toolUseCase.hoverBoundary(input, DungeonEditorSessionValues.Tool.DOOR_DELETE);
    }
}
