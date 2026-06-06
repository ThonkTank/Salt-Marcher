package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.MainViewInput;
import src.domain.dungeon.model.runtime.usecase.InterpretDungeonEditorMainViewInputUseCase.PointerAction;

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
        effectUseCase.applyEffect(mainViewInterpreter.selection(
                PointerAction.PRESS,
                input,
                committedSnapshot,
                workflow.session().selection(),
                workflow.session().projectionLevel()));
    }

    public void drag(MainViewInput input) {
        if (effectUseCase.committedGridOrPublishCurrent() != null) {
            effectUseCase.applyEffect(mainViewInterpreter.selection(
                    PointerAction.DRAG,
                    input,
                    null,
                    workflow.session().selection(),
                    workflow.session().projectionLevel()));
        }
    }

    public void release(MainViewInput input) {
        if (effectUseCase.committedGridOrPublishCurrent() != null) {
            effectUseCase.applyEffect(mainViewInterpreter.selection(
                    PointerAction.RELEASE,
                    input,
                    null,
                    workflow.session().selection(),
                    workflow.session().projectionLevel()));
        }
    }

    public void hover(MainViewInput input) {
        effectUseCase.applyEffect(mainViewInterpreter.selection(
                PointerAction.HOVER,
                input,
                null,
                workflow.session().selection(),
                workflow.session().projectionLevel()));
    }

    public void scroll(int projectionLevelDelta) {
        effectUseCase.applyEffect(mainViewInterpreter.scrollSelection(
                projectionLevelDelta,
                workflow.session().projectionLevel(),
                effectUseCase.loadCommittedSnapshot()));
    }

}
