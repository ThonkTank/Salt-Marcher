package src.domain.dungeon.model.runtime.usecase;

import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.MainViewInput;

public final class ApplyDungeonEditorDeleteCorridorUseCase {
    private final DungeonEditorApplyToolUseCase toolUseCase;

    public ApplyDungeonEditorDeleteCorridorUseCase(
            DungeonEditorSessionWorkflow workflow,
            InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        this.toolUseCase = new DungeonEditorApplyToolUseCase(workflow, mainViewInterpreter, effectUseCase);
    }

    public void press(MainViewInput input) {
        toolUseCase.pressCorridor(input, DungeonEditorSessionValues.Tool.CORRIDOR_DELETE);
    }

    public void hover(MainViewInput input) {
        toolUseCase.hoverCorridor(input, DungeonEditorSessionValues.Tool.CORRIDOR_DELETE);
    }
}
