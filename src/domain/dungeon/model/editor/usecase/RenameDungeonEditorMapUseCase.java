package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.editor.repository.DungeonEditorDungeonRepository;
import src.domain.dungeon.model.editor.port.DungeonEditorDungeonPort;

public final class RenameDungeonEditorMapUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final DungeonEditorDungeonRepository dungeonRepository;
    private final DungeonEditorDungeonPort dungeonPort;
    private final BuildDungeonEditorSnapshotUseCase snapshotBuilder;
    private final PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase;
    public RenameDungeonEditorMapUseCase(
            DungeonEditorSessionWorkflow workflow,
            DungeonEditorDungeonRepository dungeonRepository,
            DungeonEditorDungeonPort dungeonPort,
            BuildDungeonEditorSnapshotUseCase snapshotBuilder,
            PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.dungeonRepository = Objects.requireNonNull(dungeonRepository, "dungeonRepository");
        this.dungeonPort = Objects.requireNonNull(dungeonPort, "dungeonPort");
        this.snapshotBuilder = Objects.requireNonNull(snapshotBuilder, "snapshotBuilder");
        this.snapshotPublicationUseCase =
                Objects.requireNonNull(snapshotPublicationUseCase, "snapshotPublicationUseCase");
    }

    public void execute(long mapId, String mapName) {
        dungeonRepository.renameMap(mapId > 0L ? new DungeonEditorWorkspaceValues.MapId(mapId) : null, mapName);
        DungeonEditorWorkspaceValues.MapId nextMapId = dungeonPort.currentFacts(
                workflow.selectedMapId(),
                workflow.selection(),
                workflow.preview()).mutationMapId();
        workflow.mapRenamed(nextMapId);
        snapshotPublicationUseCase.execute(workflow.reconcileSnapshot(snapshotBuilder.execute(workflow.session())));
    }
}
