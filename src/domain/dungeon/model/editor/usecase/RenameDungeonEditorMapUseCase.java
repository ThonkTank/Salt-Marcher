package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonState;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

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

    public void execute(long mapId, String mapName) {
        if (DungeonEditorWorkspaceValues.hasId(mapId)) {
            renameMapUseCase.execute(new DungeonEditorWorkspaceValues.MapId(mapId), mapName);
        }
        DungeonEditorWorkspaceValues.MapId nextMapId = dungeonState.currentFacts(
                workflow.selectedMapId(),
                workflow.selection(),
                workflow.preview()).mutationMapId();
        workflow.mapRenamed(nextMapId);
        snapshotPublicationUseCase.execute(workflow.reconcileSnapshot(snapshotBuilder.execute(workflow.session())));
    }
}
