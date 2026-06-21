package src.features.dungeon.runtime;

import java.util.Objects;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSessionEffectUseCase;
import src.features.dungeon.runtime.InterpretDungeonEditorMainViewInputUseCase.PointerAction;

final class ApplyDungeonEditorSelectionUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;

    ApplyDungeonEditorSelectionUseCase(
            DungeonEditorSessionWorkflow workflow,
            InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.mainViewInterpreter = Objects.requireNonNull(mainViewInterpreter, "mainViewInterpreter");
        this.effectUseCase = Objects.requireNonNull(effectUseCase, "effectUseCase");
    }

    void press(DungeonEditorMainViewInput input) {
        MapSnapshot committedSnapshot = effectUseCase.committedGridOrPublishCurrent();
        if (committedSnapshot == null) {
            return;
        }
        effectUseCase.applyEffect(mainViewInterpreter.selection(
                PointerAction.PRESS,
                input,
                committedSnapshot,
                workflow.session().selection(),
                workflow.session().projectionLevel()), null);
    }

    void drag(DungeonEditorMainViewInput input) {
        if (effectUseCase.committedGridOrPublishCurrent() != null) {
            effectUseCase.applyEffect(mainViewInterpreter.selection(
                    PointerAction.DRAG,
                    input,
                    null,
                    workflow.session().selection(),
                    workflow.session().projectionLevel()), null);
        }
    }

    void release(DungeonEditorMainViewInput input) {
        if (effectUseCase.committedGridOrPublishCurrent() != null) {
            effectUseCase.applyEffect(mainViewInterpreter.selection(
                    PointerAction.RELEASE,
                    input,
                    null,
                    workflow.session().selection(),
                    workflow.session().projectionLevel()), null);
        }
    }

    void hover(DungeonEditorMainViewInput input) {
        effectUseCase.applyEffect(mainViewInterpreter.selection(
                PointerAction.HOVER,
                input,
                null,
                workflow.session().selection(),
                workflow.session().projectionLevel()), null);
    }

    void scroll(int projectionLevelDelta) {
        effectUseCase.applyEffect(mainViewInterpreter.scrollSelection(
                projectionLevelDelta,
                workflow.session().projectionLevel(),
                effectUseCase.loadCommittedSnapshot()), null);
    }

}
