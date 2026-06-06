package src.domain.dungeon.model.runtime.usecase;

import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.MainViewInput;

public final class ApplyDungeonEditorCreateWallUseCase {
    private final DungeonEditorApplyToolUseCase toolUseCase;

    public ApplyDungeonEditorCreateWallUseCase(
            DungeonEditorSessionWorkflow workflow,
            InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        this.toolUseCase = new DungeonEditorApplyToolUseCase(workflow, mainViewInterpreter, effectUseCase);
    }

    public void press(MainViewInput input) {
        toolUseCase.pressBoundary(input, DungeonEditorSessionValues.Tool.WALL_CREATE);
    }

    public void drag(MainViewInput input) {
        toolUseCase.dragBoundary(input, DungeonEditorSessionValues.Tool.WALL_CREATE);
    }

    public void release(MainViewInput input) {
        toolUseCase.releaseBoundary(input, DungeonEditorSessionValues.Tool.WALL_CREATE);
    }

    public void hover(MainViewInput input) {
        toolUseCase.hoverBoundary(input, DungeonEditorSessionValues.Tool.WALL_CREATE);
    }
}
