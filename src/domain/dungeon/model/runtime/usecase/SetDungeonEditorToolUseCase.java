package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;

public final class SetDungeonEditorToolUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final BuildDungeonEditorSnapshotUseCase snapshotBuilder;
    private final PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase;
    public SetDungeonEditorToolUseCase(
            DungeonEditorSessionWorkflow workflow,
            BuildDungeonEditorSnapshotUseCase snapshotBuilder,
            PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.snapshotBuilder = Objects.requireNonNull(snapshotBuilder, "snapshotBuilder");
        this.snapshotPublicationUseCase =
                Objects.requireNonNull(snapshotPublicationUseCase, "snapshotPublicationUseCase");
    }

    public DungeonEditorSessionSnapshot.SnapshotData execute(String toolName) {
        DungeonEditorSessionSnapshot.SnapshotData snapshot = snapshot(toolName);
        snapshotPublicationUseCase.execute(snapshot);
        return snapshot;
    }

    public DungeonEditorSessionSnapshot.ControlsData executeControlsOnly(String toolName) {
        workflow.setTool(toolName);
        DungeonEditorSessionSnapshot.ControlsData controls =
                DungeonEditorSessionSnapshot.controlsData(workflow.session());
        snapshotPublicationUseCase.executeControls(controls);
        return controls;
    }

    private DungeonEditorSessionSnapshot.SnapshotData snapshot(String toolName) {
        workflow.setTool(toolName);
        return workflow.reconcileSnapshot(snapshotBuilder.execute(workflow.session()));
    }
}
