package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorDungeonFacts;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorDungeonState;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.worldspace.usecase.ApplyDungeonEditorAuthoredOperationUseCase;

public final class ApplyDungeonEditorSessionEffectUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final ApplyDungeonEditorAuthoredOperationUseCase applyOperationUseCase;
    private final DungeonEditorDungeonState dungeonState;
    private final BuildDungeonEditorSnapshotUseCase snapshotBuilder;
    private final PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase;

    public ApplyDungeonEditorSessionEffectUseCase(
            DungeonEditorSessionWorkflow workflow,
            ApplyDungeonEditorAuthoredOperationUseCase applyOperationUseCase,
            DungeonEditorDungeonState dungeonState,
            BuildDungeonEditorSnapshotUseCase snapshotBuilder,
            PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.applyOperationUseCase = Objects.requireNonNull(applyOperationUseCase, "applyOperationUseCase");
        this.dungeonState = Objects.requireNonNull(dungeonState, "dungeonState");
        this.snapshotBuilder = Objects.requireNonNull(snapshotBuilder, "snapshotBuilder");
        this.snapshotPublicationUseCase =
                Objects.requireNonNull(snapshotPublicationUseCase, "snapshotPublicationUseCase");
    }

    public DungeonEditorWorkspaceValues.@Nullable MapSnapshot loadCommittedSnapshot() {
        return snapshotBuilder.loadCommittedSnapshot(workflow.session().selectedMapId());
    }

    DungeonEditorSessionSnapshot.SnapshotData currentSnapshot() {
        return workflow.reconcileSnapshot(snapshotBuilder.execute(workflow.session()));
    }

    public void publishCurrent() {
        snapshotPublicationUseCase.execute(currentSnapshot());
    }

    public DungeonEditorWorkspaceValues.@Nullable MapSnapshot committedGridOrPublishCurrent() {
        DungeonEditorWorkspaceValues.MapSnapshot committedSnapshot = loadCommittedSnapshot();
        if (!workflow.session().hasSelectedMap() || committedSnapshot == null || !workflow.session().viewMode().isGrid()) {
            publishCurrent();
            return null;
        }
        return committedSnapshot;
    }

    public void applyEffect(DungeonEditorMainViewEffect effect) {
        DungeonEditorSessionValues.Preview applyPreview = workflow.applyEffect(effect);
        if (applyPreview != null) {
            if (workflow.session().selectedMapId() != null) {
                applyOperationUseCase.execute(workflow.session().selectedMapId(), applyPreview);
            }
            workflow.clearPreviewWithStatus(currentFacts().mutationStatusText());
            if (clearsSelectionAfterApply(applyPreview)) {
                workflow.applyEffect(DungeonEditorMainViewEffect.clearedSelection());
            }
        }
        publishCurrent();
    }

    public DungeonEditorDungeonFacts currentFacts() {
        return dungeonState.currentFacts(
                workflow.session().selectedMapId(),
                workflow.session().selection(),
                workflow.session().preview());
    }

    private static boolean clearsSelectionAfterApply(DungeonEditorSessionValues.Preview preview) {
        return switch (preview) {
            case DungeonEditorSessionValues.RoomRectanglePreview room -> room.deleteMode();
            case DungeonEditorSessionValues.ClusterBoundariesPreview boundaries -> boundaries.deleteMode();
            case DungeonEditorSessionValues.DeleteCorridorPreview ignored -> true;
            case DungeonEditorSessionValues.NoPreview ignored -> false;
            case DungeonEditorSessionValues.CorridorCreatePreview ignored -> false;
            case DungeonEditorSessionValues.MoveHandlePreview ignored -> false;
            case DungeonEditorSessionValues.MoveBoundaryStretchPreview ignored -> false;
        };
    }
}
