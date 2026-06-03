package src.domain.dungeon.model.worldspace.usecase;

import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.worldspace.usecase.BuildDungeonEditorMainViewInputUseCase.MainViewInput;

public final class ApplyDungeonEditorCreateDoorUseCase {
    private final DungeonEditorApplyToolUseCase toolUseCase;

    public ApplyDungeonEditorCreateDoorUseCase(
            DungeonEditorSessionWorkflow workflow,
            InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        this.toolUseCase = new DungeonEditorApplyToolUseCase(workflow, mainViewInterpreter, effectUseCase);
    }

    public void press(MainViewInput input) {
        toolUseCase.pressBoundary(input, DungeonEditorSessionValues.Tool.DOOR_CREATE);
    }

    public void drag(MainViewInput input) {
        toolUseCase.dragBoundary(input, DungeonEditorSessionValues.Tool.DOOR_CREATE);
    }

    public void release(MainViewInput input) {
        toolUseCase.releaseBoundary(input, DungeonEditorSessionValues.Tool.DOOR_CREATE);
    }

    public void hover(MainViewInput input) {
        toolUseCase.hoverBoundary(input, DungeonEditorSessionValues.Tool.DOOR_CREATE);
    }
}
