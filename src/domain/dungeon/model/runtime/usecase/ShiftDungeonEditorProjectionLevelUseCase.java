package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;

public final class ShiftDungeonEditorProjectionLevelUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase;
    public ShiftDungeonEditorProjectionLevelUseCase(
            DungeonEditorSessionWorkflow workflow,
            PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.snapshotPublicationUseCase =
                Objects.requireNonNull(snapshotPublicationUseCase, "snapshotPublicationUseCase");
    }

    public DungeonEditorSessionSnapshot.SessionFrameData execute(int projectionLevelDelta) {
        workflow.shiftProjectionLevel(projectionLevelDelta);
        DungeonEditorSessionSnapshot.SessionFrameData frameData =
                DungeonEditorSessionSnapshot.sessionFrameData(workflow.session());
        snapshotPublicationUseCase.executeSessionFrame(frameData);
        return frameData;
    }
}
