package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import src.domain.dungeon.model.editor.usecase.BuildDungeonEditorMainViewInputUseCase.MainViewInput;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSnapshot;

public final class ApplyDungeonEditorCreateWallUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;

    public ApplyDungeonEditorCreateWallUseCase(
            DungeonEditorSessionWorkflow workflow,
            InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.mainViewInterpreter = Objects.requireNonNull(mainViewInterpreter, "mainViewInterpreter");
        this.effectUseCase = Objects.requireNonNull(effectUseCase, "effectUseCase");
    }

    public void press(MainViewInput input) {
        applyPress(input, DungeonEditorSessionValues.Tool.WALL_CREATE);
    }

    public void drag(MainViewInput input) {
        applyDrag(input, DungeonEditorSessionValues.Tool.WALL_CREATE);
    }

    public void hover(MainViewInput input) {
        applyHover(input, DungeonEditorSessionValues.Tool.WALL_CREATE);
    }

    private void applyPress(MainViewInput input, DungeonEditorSessionValues.Tool tool) {
        MapSnapshot committedSnapshot = effectUseCase.committedGridOrPublishCurrent();
        if (committedSnapshot == null) {
            return;
        }
        effectUseCase.applyEffect(mainViewInterpreter.pressBoundary(
                input,
                committedSnapshot,
                workflow.selection(),
                tool,
                workflow.projectionLevel()));
    }

    private void applyDrag(MainViewInput input, DungeonEditorSessionValues.Tool tool) {
        MapSnapshot committedSnapshot = effectUseCase.committedGridOrPublishCurrent();
        if (committedSnapshot == null) {
            return;
        }
        effectUseCase.applyEffect(mainViewInterpreter.dragBoundary(
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
        effectUseCase.applyEffect(mainViewInterpreter.hoverBoundary(
                input,
                committedSnapshot,
                tool,
                workflow.projectionLevel()));
    }
}
