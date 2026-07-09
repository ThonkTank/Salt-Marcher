package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;

public final class SetDungeonEditorOverlayUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase;
    public SetDungeonEditorOverlayUseCase(
            DungeonEditorSessionWorkflow workflow,
            PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.snapshotPublicationUseCase =
                Objects.requireNonNull(snapshotPublicationUseCase, "snapshotPublicationUseCase");
    }

    public DungeonEditorSessionSnapshot.SessionFrameData execute(
            DungeonEditorSessionValues.OverlaySettings overlaySettings
    ) {
        workflow.setOverlay(overlaySettings);
        DungeonEditorSessionSnapshot.SessionFrameData frameData =
                DungeonEditorSessionSnapshot.sessionFrameData(workflow.session());
        snapshotPublicationUseCase.executeSessionFramePreservingSurface(frameData);
        return frameData;
    }
}
