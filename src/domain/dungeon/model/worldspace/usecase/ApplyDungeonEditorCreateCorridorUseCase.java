package src.domain.dungeon.model.worldspace.usecase;

import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.worldspace.usecase.BuildDungeonEditorMainViewInputUseCase.MainViewInput;

public final class ApplyDungeonEditorCreateCorridorUseCase {
    private final DungeonEditorApplyToolUseCase toolUseCase;

    public ApplyDungeonEditorCreateCorridorUseCase(
            DungeonEditorSessionWorkflow workflow,
            InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        this.toolUseCase = new DungeonEditorApplyToolUseCase(workflow, mainViewInterpreter, effectUseCase);
    }

    public void press(MainViewInput input) {
        toolUseCase.pressCorridor(input, DungeonEditorSessionValues.Tool.CORRIDOR_CREATE);
    }

    public void hover(MainViewInput input) {
        toolUseCase.hoverCorridor(input, DungeonEditorSessionValues.Tool.CORRIDOR_CREATE);
    }
}
