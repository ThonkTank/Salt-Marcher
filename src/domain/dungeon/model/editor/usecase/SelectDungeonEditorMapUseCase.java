package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionWorkflow;

public final class SelectDungeonEditorMapUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final BuildDungeonEditorSnapshotUseCase snapshotBuilder;
    private final PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase;
    private final InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter;
    public SelectDungeonEditorMapUseCase(
            DungeonEditorSessionWorkflow workflow,
            BuildDungeonEditorSnapshotUseCase snapshotBuilder,
            InterpretDungeonEditorMainViewInputUseCase mainViewInterpreter,
            PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.snapshotBuilder = Objects.requireNonNull(snapshotBuilder, "snapshotBuilder");
        this.snapshotPublicationUseCase =
                Objects.requireNonNull(snapshotPublicationUseCase, "snapshotPublicationUseCase");
        this.mainViewInterpreter = Objects.requireNonNull(mainViewInterpreter, "mainViewInterpreter");
    }

    public void execute(long mapId) {
        mainViewInterpreter.clear();
        workflow.selectMap(mapId);
        snapshotPublicationUseCase.execute(workflow.reconcileSnapshot(snapshotBuilder.execute(workflow.session())));
    }
}
