package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import src.domain.dungeon.model.editor.usecase.BuildDungeonEditorMainViewInputUseCase.MainViewInput;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSnapshot;

public final class ApplyDungeonEditorSelectionUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;

    public ApplyDungeonEditorSelectionUseCase(
            DungeonEditorSessionWorkflow workflow,
            InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.mainViewInterpreter = Objects.requireNonNull(mainViewInterpreter, "mainViewInterpreter");
        this.effectUseCase = Objects.requireNonNull(effectUseCase, "effectUseCase");
    }

    public void press(MainViewInput input) {
        MapSnapshot committedSnapshot = effectUseCase.committedGridOrPublishCurrent();
        if (committedSnapshot == null) {
            return;
        }
        effectUseCase.applyEffect(mainViewInterpreter.pressSelection(
                input,
                committedSnapshot,
                workflow.selection(),
                workflow.projectionLevel()));
    }

    public void drag(MainViewInput input) {
        if (effectUseCase.committedGridOrPublishCurrent() != null) {
            effectUseCase.applyEffect(mainViewInterpreter.dragSelection(
                    input,
                    workflow.projectionLevel()));
        }
    }

    public void release(MainViewInput input) {
        if (effectUseCase.committedGridOrPublishCurrent() != null) {
            effectUseCase.applyEffect(mainViewInterpreter.releaseSelection(
                    input,
                    workflow.projectionLevel()));
        }
    }

    public void hover(MainViewInput input) {
        effectUseCase.applyEffect(mainViewInterpreter.hoverSelection());
    }

    public void scroll(int projectionLevelDelta) {
        effectUseCase.applyEffect(mainViewInterpreter.scrollSelection(
                projectionLevelDelta,
                workflow.projectionLevel(),
                effectUseCase.loadCommittedSnapshot()));
    }

}
