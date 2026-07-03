package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorDungeonState;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;

public final class RenameDungeonEditorMapUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final RenameDungeonEditorMapCatalogUseCase renameMapUseCase;
    private final DungeonEditorDungeonState dungeonState;
    private final BuildDungeonEditorSnapshotUseCase snapshotBuilder;
    private final PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase;
    public RenameDungeonEditorMapUseCase(
            DungeonEditorSessionWorkflow workflow,
            RenameDungeonEditorMapCatalogUseCase renameMapUseCase,
            DungeonEditorDungeonState dungeonState,
            BuildDungeonEditorSnapshotUseCase snapshotBuilder,
            PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.renameMapUseCase = Objects.requireNonNull(renameMapUseCase, "renameMapUseCase");
        this.dungeonState = Objects.requireNonNull(dungeonState, "dungeonState");
        this.snapshotBuilder = Objects.requireNonNull(snapshotBuilder, "snapshotBuilder");
        this.snapshotPublicationUseCase =
                Objects.requireNonNull(snapshotPublicationUseCase, "snapshotPublicationUseCase");
    }

    public DungeonEditorSessionSnapshot.SnapshotData execute(long mapId, String mapName) {
        if (DungeonEditorWorkspaceValues.hasId(mapId)) {
            renameMapUseCase.execute(new DungeonEditorWorkspaceValues.MapId(mapId), mapName);
        }
        DungeonEditorWorkspaceValues.MapId nextMapId = dungeonState.currentFacts(
                workflow.session().selectedMapId(),
                workflow.session().selection(),
                workflow.session().preview()).mutationMapId();
        workflow.applyMapLifecycle(DungeonEditorSessionWorkflow.MAP_RENAMED, nextMapId);
        snapshotBuilder.refreshAuthoredSnapshot(workflow.session());
        DungeonEditorSessionSnapshot.SnapshotData snapshot =
                workflow.reconcileSnapshot(snapshotBuilder.execute(workflow.session()));
        snapshotPublicationUseCase.execute(snapshot);
        return snapshot;
    }
}
