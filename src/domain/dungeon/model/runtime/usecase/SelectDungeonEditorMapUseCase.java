package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;

public final class SelectDungeonEditorMapUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final BuildDungeonEditorSnapshotUseCase snapshotBuilder;
    private final PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase;
    public SelectDungeonEditorMapUseCase(
            DungeonEditorSessionWorkflow workflow,
            BuildDungeonEditorSnapshotUseCase snapshotBuilder,
            PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.snapshotBuilder = Objects.requireNonNull(snapshotBuilder, "snapshotBuilder");
        this.snapshotPublicationUseCase =
                Objects.requireNonNull(snapshotPublicationUseCase, "snapshotPublicationUseCase");
    }

    public void execute(long mapId) {
        workflow.selectMap(mapId);
        snapshotBuilder.refreshAuthoredSnapshot(workflow.session());
        snapshotPublicationUseCase.execute(workflow.reconcileSnapshot(snapshotBuilder.execute(workflow.session())));
    }
}
