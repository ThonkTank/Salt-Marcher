package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.editor.usecase.BuildDungeonEditorMainViewInputUseCase.MainViewInput;

final class DungeonEditorApplyToolUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;

    DungeonEditorApplyToolUseCase(
            DungeonEditorSessionWorkflow workflow,
            InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.mainViewInterpreter = Objects.requireNonNull(mainViewInterpreter, "mainViewInterpreter");
        this.effectUseCase = Objects.requireNonNull(effectUseCase, "effectUseCase");
    }

    void pressBoundary(MainViewInput input, DungeonEditorSessionValues.Tool tool) {
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

    void dragBoundary(MainViewInput input, DungeonEditorSessionValues.Tool tool) {
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

    void releaseBoundary(MainViewInput input, DungeonEditorSessionValues.Tool tool) {
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

    void hoverBoundary(MainViewInput input, DungeonEditorSessionValues.Tool tool) {
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

    void pressCorridor(MainViewInput input, DungeonEditorSessionValues.Tool tool) {
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

    void hoverCorridor(MainViewInput input, DungeonEditorSessionValues.Tool tool) {
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
