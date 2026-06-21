package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorDungeonFacts;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorDungeonState;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;

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

    public void publishCurrent() {
        snapshotPublicationUseCase.execute(workflow.reconcileSnapshot(snapshotBuilder.execute(workflow.session())));
    }

    public void publishSessionPreview() {
        snapshotPublicationUseCase.execute(workflow.reconcileSnapshot(
                snapshotBuilder.executeSessionPreview(workflow.session())));
    }

    private void publishInMemoryPreview() {
        snapshotPublicationUseCase.execute(workflow.reconcileSnapshot(
                snapshotBuilder.executeInMemoryPreview(workflow.session())));
    }

    public DungeonEditorWorkspaceValues.@Nullable MapSnapshot committedGridOrPublishCurrent() {
        DungeonEditorWorkspaceValues.MapSnapshot committedSnapshot = loadCommittedSnapshot();
        if (!workflow.session().hasSelectedMap() || committedSnapshot == null || !workflow.session().viewMode().isGrid()) {
            publishCurrent();
            return null;
        }
        return committedSnapshot;
    }

    public void applyEffect(DungeonEditorSessionEffect effect, @Nullable AuthoredCommit authoredCommit) {
        if (effect == null) {
            publishCurrent();
            return;
        }
        DungeonEditorSessionValues.Preview previousPreview = workflow.session().preview();
        DungeonEditorSessionValues.Preview applyPreview = workflow.applyEffect(effect);
        if (applyPreview != null) {
            applyAuthoredPreview(applyPreview, authoredCommit);
            publishCurrent();
            return;
        }
        if (!DungeonEditorSessionPreviewUseCase.inMemoryDragPreview(effect.getPreview())) {
            publishCurrent();
            return;
        }
        if (previousPreview.equals(workflow.session().preview())) {
            return;
        }
        publishInMemoryPreview();
    }

    public DungeonEditorDungeonFacts currentFacts() {
        return dungeonState.currentFacts(
                workflow.session().selectedMapId(),
                workflow.session().selection(),
                workflow.session().preview());
    }

    private void applyAuthoredPreview(
            DungeonEditorSessionValues.Preview applyPreview,
            @Nullable AuthoredCommit authoredCommit
    ) {
        DungeonEditorWorkspaceValues.MapId mapId = workflow.session().selectedMapId();
        if (mapId != null && authoredCommit == null) {
            applyOperationUseCase.execute(mapId, applyPreview);
        }
        if (mapId != null && authoredCommit != null) {
            authoredCommit.apply(mapId);
        }
        workflow.clearPreviewWithStatus(currentFacts().mutationStatusText());
        if (DungeonEditorSessionPreviewUseCase.clearsSelectionAfterApply(applyPreview)) {
            workflow.applyEffect(DungeonEditorSessionEffect.clearedSelection());
        }
    }

    @FunctionalInterface
    public interface AuthoredCommit {
        void apply(DungeonEditorWorkspaceValues.MapId mapId);
    }
}
