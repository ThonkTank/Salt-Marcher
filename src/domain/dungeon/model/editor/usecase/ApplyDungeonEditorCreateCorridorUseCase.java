package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import src.domain.dungeon.model.editor.usecase.InterpretDungeonEditorMainViewInputUseCase.MainViewInput;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSnapshot;

public final class ApplyDungeonEditorCreateCorridorUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;

    public ApplyDungeonEditorCreateCorridorUseCase(
            DungeonEditorSessionWorkflow workflow,
            InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.mainViewInterpreter = Objects.requireNonNull(mainViewInterpreter, "mainViewInterpreter");
        this.effectUseCase = Objects.requireNonNull(effectUseCase, "effectUseCase");
    }

    public void press(MainViewInput input) {
        applyPress(input, DungeonEditorSessionValues.Tool.CORRIDOR_CREATE);
    }

    public void hover(MainViewInput input) {
        applyHover(input, DungeonEditorSessionValues.Tool.CORRIDOR_CREATE);
    }

    private void applyPress(MainViewInput input, DungeonEditorSessionValues.Tool tool) {
        MapSnapshot committedSnapshot = effectUseCase.committedGridOrPublishCurrent();
        if (committedSnapshot == null) {
            return;
        }
        effectUseCase.applyEffect(mainViewInterpreter.pressCorridor(
                input,
                committedSnapshot,
                tool,
                workflow.projectionLevel()));
    }

    private void applyHover(MainViewInput input, DungeonEditorSessionValues.Tool tool) {
        MapSnapshot committedSnapshot = effectUseCase.committedGridOrPublishCurrent();
        if (committedSnapshot == null) {
            return;
        }
        effectUseCase.applyEffect(mainViewInterpreter.hoverCorridor(
                input,
                committedSnapshot,
                tool,
                workflow.projectionLevel()));
    }
}
