package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonState;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

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
        if (mapId > 0L) {
            deleteMapUseCase.execute(new DungeonEditorWorkspaceValues.MapId(mapId));
        }
        DungeonEditorWorkspaceValues.MapId nextMapId = dungeonState.currentFacts(
                workflow.selectedMapId(),
                workflow.selection(),
                workflow.preview()).mutationMapId();
        mainViewInterpreter.clear();
        workflow.mapDeleted(nextMapId);
        snapshotPublicationUseCase.execute(workflow.reconcileSnapshot(snapshotBuilder.execute(workflow.session())));
    }
}
