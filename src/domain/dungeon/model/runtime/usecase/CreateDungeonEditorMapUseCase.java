package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorDungeonState;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;

public final class CreateDungeonEditorMapUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final CreateDungeonEditorMapCatalogUseCase createMapUseCase;
    private final DungeonEditorDungeonState dungeonState;
    private final BuildDungeonEditorSnapshotUseCase snapshotBuilder;
    private final PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase;
    public CreateDungeonEditorMapUseCase(
            DungeonEditorSessionWorkflow workflow,
            CreateDungeonEditorMapCatalogUseCase createMapUseCase,
            DungeonEditorDungeonState dungeonState,
            BuildDungeonEditorSnapshotUseCase snapshotBuilder,
            PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.createMapUseCase = Objects.requireNonNull(createMapUseCase, "createMapUseCase");
        this.dungeonState = Objects.requireNonNull(dungeonState, "dungeonState");
        this.snapshotBuilder = Objects.requireNonNull(snapshotBuilder, "snapshotBuilder");
        this.snapshotPublicationUseCase =
                Objects.requireNonNull(snapshotPublicationUseCase, "snapshotPublicationUseCase");
    }

    public DungeonEditorSessionSnapshot.SnapshotData execute(String mapName) {
        createMapUseCase.execute(mapName);
        DungeonEditorWorkspaceValues.MapId nextMapId = dungeonState.currentFacts(
                workflow.session().selectedMapId(),
                workflow.session().selection(),
                workflow.session().preview()).mutationMapId();
        workflow.applyMapLifecycle(DungeonEditorSessionWorkflow.MAP_CREATED, nextMapId);
        snapshotBuilder.refreshAuthoredSnapshot(workflow.session());
        DungeonEditorSessionSnapshot.SnapshotData snapshot =
                workflow.reconcileSnapshot(snapshotBuilder.execute(workflow.session()));
        snapshotPublicationUseCase.execute(snapshot);
        return snapshot;
    }
}
