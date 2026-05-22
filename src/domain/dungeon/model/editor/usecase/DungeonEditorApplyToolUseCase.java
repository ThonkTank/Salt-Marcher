package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewEffect;
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
        applyCommittedSnapshotEffect((committedSnapshot, projectionLevel) -> mainViewInterpreter.pressBoundary(
                input,
                committedSnapshot,
                workflow.selection(),
                tool,
                projectionLevel));
    }

    void dragBoundary(MainViewInput input, DungeonEditorSessionValues.Tool tool) {
        applyCommittedSnapshotEffect((committedSnapshot, projectionLevel) -> mainViewInterpreter.dragBoundary(
                input,
                committedSnapshot,
                tool,
                projectionLevel));
    }

    void releaseBoundary(MainViewInput input, DungeonEditorSessionValues.Tool tool) {
        applyCommittedSnapshotEffect((committedSnapshot, projectionLevel) -> mainViewInterpreter.releaseBoundary(
                input,
                committedSnapshot,
                tool,
                projectionLevel));
    }

    void hoverBoundary(MainViewInput input, DungeonEditorSessionValues.Tool tool) {
        applyCommittedSnapshotEffect((committedSnapshot, projectionLevel) -> mainViewInterpreter.hoverBoundary(
                input,
                committedSnapshot,
                tool,
                projectionLevel));
    }

    void pressCorridor(MainViewInput input, DungeonEditorSessionValues.Tool tool) {
        applyCommittedSnapshotEffect((committedSnapshot, projectionLevel) -> mainViewInterpreter.pressCorridor(
                input,
                committedSnapshot,
                tool,
                projectionLevel));
    }

    void hoverCorridor(MainViewInput input, DungeonEditorSessionValues.Tool tool) {
        applyCommittedSnapshotEffect((committedSnapshot, projectionLevel) -> mainViewInterpreter.hoverCorridor(
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
        effectUseCase.applyEffect(effectFactory.create(committedSnapshot, workflow.projectionLevel()));
    }

    @FunctionalInterface
    private interface CommittedSnapshotEffect {
        DungeonEditorMainViewEffect create(MapSnapshot committedSnapshot, int projectionLevel);
    }
}
