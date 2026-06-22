package src.features.dungeon.runtime;

import java.util.Objects;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSessionEffectUseCase;
import src.features.dungeon.runtime.ApplyDungeonEditorToolWorkflowUseCase.PointerToolUseCase;
import src.features.dungeon.runtime.InterpretDungeonEditorMainViewInputUseCase.PointerAction;

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

    PointerToolUseCase corridorWorkflow(DungeonEditorSessionValues.Tool tool) {
        return workflowFor(
                input -> applyCorridor(PointerAction.PRESS, input, tool),
                null,
                null,
                input -> applyCorridor(PointerAction.HOVER, input, tool));
    }

    private void applyCorridor(PointerAction action, DungeonEditorMainViewInput input, DungeonEditorSessionValues.Tool tool) {
        applyCommittedSnapshotEffect((committedSnapshot, projectionLevel) -> mainViewInterpreter.corridor(
                action,
                input,
                committedSnapshot,
                tool,
                projectionLevel));
    }

    private static PointerToolUseCase workflowFor(
            ApplyDungeonEditorToolWorkflowUseCase.PointerAction press,
            ApplyDungeonEditorToolWorkflowUseCase.PointerAction drag,
            ApplyDungeonEditorToolWorkflowUseCase.PointerAction release,
            ApplyDungeonEditorToolWorkflowUseCase.PointerAction hover
    ) {
        return new PointerToolUseCase(press, drag, release, hover);
    }

    private void applyCommittedSnapshotEffect(CommittedSnapshotEffect effectFactory) {
        MapSnapshot committedSnapshot = effectUseCase.committedGridOrPublishCurrent();
        if (committedSnapshot == null) {
            return;
        }
        DungeonEditorSessionEffect effect = effectFactory.create(committedSnapshot, workflow.session().projectionLevel());
        effectUseCase.applyEffect(effect, null);
    }

    @FunctionalInterface
    private interface CommittedSnapshotEffect {
        DungeonEditorSessionEffect create(MapSnapshot committedSnapshot, int projectionLevel);
    }

}
