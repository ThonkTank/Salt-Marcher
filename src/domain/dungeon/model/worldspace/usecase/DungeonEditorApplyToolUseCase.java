package src.domain.dungeon.model.worldspace.usecase;

import java.util.Objects;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapSnapshot;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSessionEffectUseCase;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.MainViewInput;
import src.domain.dungeon.model.runtime.usecase.InterpretDungeonEditorMainViewInputUseCase.PointerAction;
import src.domain.dungeon.model.runtime.usecase.InterpretDungeonEditorMainViewInputUseCase;

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
        applyCommittedSnapshotEffect((committedSnapshot, projectionLevel) -> mainViewInterpreter.boundary(
                PointerAction.PRESS,
                input,
                committedSnapshot,
                workflow.session().selection(),
                tool,
                projectionLevel));
    }

    void dragBoundary(MainViewInput input, DungeonEditorSessionValues.Tool tool) {
        applyCommittedSnapshotEffect((committedSnapshot, projectionLevel) -> mainViewInterpreter.boundary(
                PointerAction.DRAG,
                input,
                committedSnapshot,
                workflow.session().selection(),
                tool,
                projectionLevel));
    }

    void releaseBoundary(MainViewInput input, DungeonEditorSessionValues.Tool tool) {
        applyCommittedSnapshotEffect((committedSnapshot, projectionLevel) -> mainViewInterpreter.boundary(
                PointerAction.RELEASE,
                input,
                committedSnapshot,
                workflow.session().selection(),
                tool,
                projectionLevel));
    }

    void hoverBoundary(MainViewInput input, DungeonEditorSessionValues.Tool tool) {
        applyCommittedSnapshotEffect((committedSnapshot, projectionLevel) -> mainViewInterpreter.boundary(
                PointerAction.HOVER,
                input,
                committedSnapshot,
                workflow.session().selection(),
                tool,
                projectionLevel));
    }

    void pressCorridor(MainViewInput input, DungeonEditorSessionValues.Tool tool) {
        applyCommittedSnapshotEffect((committedSnapshot, projectionLevel) -> mainViewInterpreter.corridor(
                PointerAction.PRESS,
                input,
                committedSnapshot,
                tool,
                projectionLevel));
    }

    void hoverCorridor(MainViewInput input, DungeonEditorSessionValues.Tool tool) {
        applyCommittedSnapshotEffect((committedSnapshot, projectionLevel) -> mainViewInterpreter.corridor(
                PointerAction.HOVER,
                input,
                committedSnapshot,
                tool,
                projectionLevel));
    }

    private void applyCommittedSnapshotEffect(CommittedSnapshotEffect effectFactory) {
        MapSnapshot committedSnapshot = effectUseCase.committedGridOrPublishCurrent();
        if (committedSnapshot == null) {
            return;
        }
        effectUseCase.applyEffect(effectFactory.create(committedSnapshot, workflow.session().projectionLevel()));
    }

    @FunctionalInterface
    private interface CommittedSnapshotEffect {
        DungeonEditorMainViewEffect create(MapSnapshot committedSnapshot, int projectionLevel);
    }
}
