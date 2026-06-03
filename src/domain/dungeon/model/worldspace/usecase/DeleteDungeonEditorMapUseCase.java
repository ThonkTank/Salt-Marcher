package src.domain.dungeon.model.worldspace.usecase;

import java.util.Objects;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorDungeonState;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorSnapshotUseCase;
import src.domain.dungeon.model.runtime.usecase.InterpretDungeonEditorMainViewInputUseCase;
import src.domain.dungeon.model.runtime.usecase.PublishDungeonEditorSnapshotUseCase;

public final class DeleteDungeonEditorMapUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final DeleteDungeonEditorMapCatalogUseCase deleteMapUseCase;
    private final DungeonEditorDungeonState dungeonState;
    private final BuildDungeonEditorSnapshotUseCase snapshotBuilder;
    private final PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase;
    private final InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter;
    public DeleteDungeonEditorMapUseCase(
            DungeonEditorSessionWorkflow workflow,
            DeleteDungeonEditorMapCatalogUseCase deleteMapUseCase,
            DungeonEditorDungeonState dungeonState,
            BuildDungeonEditorSnapshotUseCase snapshotBuilder,
            InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter,
            PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.deleteMapUseCase = Objects.requireNonNull(deleteMapUseCase, "deleteMapUseCase");
        this.dungeonState = Objects.requireNonNull(dungeonState, "dungeonState");
        this.snapshotBuilder = Objects.requireNonNull(snapshotBuilder, "snapshotBuilder");
        this.snapshotPublicationUseCase =
                Objects.requireNonNull(snapshotPublicationUseCase, "snapshotPublicationUseCase");
        this.mainViewInterpreter = Objects.requireNonNull(mainViewInterpreter, "mainViewInterpreter");
    }

    public void execute(long mapId) {
        if (DungeonEditorWorkspaceValues.hasId(mapId)) {
            deleteMapUseCase.execute(new DungeonEditorWorkspaceValues.MapId(mapId));
        }
        DungeonEditorWorkspaceValues.MapId nextMapId = dungeonState.currentFacts(
                workflow.session().selectedMapId(),
                workflow.session().selection(),
                workflow.session().preview()).mutationMapId();
        mainViewInterpreter.clear();
        workflow.applyMapLifecycle(DungeonEditorSessionWorkflow.MAP_DELETED, nextMapId);
        snapshotPublicationUseCase.execute(workflow.reconcileSnapshot(snapshotBuilder.execute(workflow.session())));
    }
}
