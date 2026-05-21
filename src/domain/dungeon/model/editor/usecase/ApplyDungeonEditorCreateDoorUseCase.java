package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import src.domain.dungeon.model.editor.usecase.InterpretDungeonEditorMainViewInputUseCase.MainViewInput;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSnapshot;

public final class ApplyDungeonEditorCreateDoorUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;

    public ApplyDungeonEditorCreateDoorUseCase(
            DungeonEditorSessionWorkflow workflow,
            InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.mainViewInterpreter = Objects.requireNonNull(mainViewInterpreter, "mainViewInterpreter");
        this.effectUseCase = Objects.requireNonNull(effectUseCase, "effectUseCase");
    }

    public void press(MainViewInput input) {
        applyPress(input, DungeonEditorSessionValues.Tool.DOOR_CREATE);
    }

    public void drag(MainViewInput input) {
        applyDrag(input, DungeonEditorSessionValues.Tool.DOOR_CREATE);
    }

    public void release(MainViewInput input) {
        applyRelease(input, DungeonEditorSessionValues.Tool.DOOR_CREATE);
    }

    public void hover(MainViewInput input) {
        applyHover(input, DungeonEditorSessionValues.Tool.DOOR_CREATE);
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

    private void applyRelease(MainViewInput input, DungeonEditorSessionValues.Tool tool) {
        MapSnapshot committedSnapshot = effectUseCase.committedGridOrPublishCurrent();
        if (committedSnapshot == null) {
            return;
        }
        effectUseCase.applyEffect(mainViewInterpreter.releaseBoundary(
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
