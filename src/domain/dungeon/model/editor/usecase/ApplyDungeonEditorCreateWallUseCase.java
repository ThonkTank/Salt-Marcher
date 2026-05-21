package src.domain.dungeon.model.editor.usecase;

import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.editor.usecase.BuildDungeonEditorMainViewInputUseCase.MainViewInput;

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

    public void hover(MainViewInput input) {
        toolUseCase.hoverBoundary(input, DungeonEditorSessionValues.Tool.WALL_CREATE);
    }
}
