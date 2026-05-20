package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.editor.port.DungeonEditorDungeonPort;
import src.domain.dungeon.model.editor.repository.DungeonEditorDungeonRepository;

public final class DeleteDungeonEditorMapUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final DungeonEditorDungeonRepository dungeonRepository;
    private final DungeonEditorDungeonPort dungeonPort;
    private final BuildDungeonEditorSnapshotUseCase snapshotBuilder;
    private final PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase;
    private final InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter;
    public DeleteDungeonEditorMapUseCase(
            DungeonEditorSessionWorkflow workflow,
            DungeonEditorDungeonRepository dungeonRepository,
            DungeonEditorDungeonPort dungeonPort,
            BuildDungeonEditorSnapshotUseCase snapshotBuilder,
            InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter,
            PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.dungeonRepository = Objects.requireNonNull(dungeonRepository, "dungeonRepository");
        this.dungeonPort = Objects.requireNonNull(dungeonPort, "dungeonPort");
        this.snapshotBuilder = Objects.requireNonNull(snapshotBuilder, "snapshotBuilder");
        this.snapshotPublicationUseCase =
                Objects.requireNonNull(snapshotPublicationUseCase, "snapshotPublicationUseCase");
        this.mainViewInterpreter = Objects.requireNonNull(mainViewInterpreter, "mainViewInterpreter");
    }

    public void execute(long mapId) {
        dungeonRepository.deleteMap(mapId > 0L ? new DungeonEditorWorkspaceValues.MapId(mapId) : null);
        DungeonEditorWorkspaceValues.MapId nextMapId = dungeonPort.currentFacts(
                workflow.selectedMapId(),
                workflow.selection(),
                workflow.preview()).mutationMapId();
        mainViewInterpreter.clear();
        workflow.mapDeleted(nextMapId);
        snapshotPublicationUseCase.execute(workflow.reconcileSnapshot(snapshotBuilder.execute(workflow.session())));
    }
}
