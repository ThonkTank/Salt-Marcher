package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorDungeonFacts;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorDungeonState;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.runtime.helper.DungeonEditorSessionPreviewHelper;

final class DungeonEditorPreviewLifecycleUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final ApplyDungeonEditorAuthoredOperationUseCase applyOperationUseCase;
    private final DungeonEditorDungeonState dungeonState;
    private final BuildDungeonEditorSnapshotUseCase snapshotBuilder;

    DungeonEditorPreviewLifecycleUseCase(
            DungeonEditorSessionWorkflow workflow,
            ApplyDungeonEditorAuthoredOperationUseCase applyOperationUseCase,
            DungeonEditorDungeonState dungeonState,
            BuildDungeonEditorSnapshotUseCase snapshotBuilder
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.applyOperationUseCase = Objects.requireNonNull(applyOperationUseCase, "applyOperationUseCase");
        this.dungeonState = Objects.requireNonNull(dungeonState, "dungeonState");
        this.snapshotBuilder = Objects.requireNonNull(snapshotBuilder, "snapshotBuilder");
    }

    PublicationOutcome preparePublishCurrent() {
        snapshotBuilder.refreshAuthoredSnapshot(workflow.session());
        return PublicationOutcome.PUBLISH_CURRENT;
    }

    CurrentGridResult committedGridOrCurrentFallback() {
        DungeonEditorWorkspaceValues.MapSnapshot committedSnapshot =
                snapshotBuilder.loadCommittedSnapshot(workflow.session().selectedMapId());
        if (workflow.session().hasSelectedMap() && committedSnapshot != null && workflow.session().viewMode().isGrid()) {
            return new CurrentGridResult(committedSnapshot, PublicationOutcome.COMMITTED_GRID_AVAILABLE);
        }
        return new CurrentGridResult(null, prepareCurrentReadback());
    }

    PublicationOutcome applyEffect(
            DungeonEditorSessionEffect effect,
            ApplyDungeonEditorSessionEffectUseCase.@Nullable AuthoredCommit authoredCommit
    ) {
        if (effect == null) {
            return preparePublishCurrent();
        }
        DungeonEditorSessionValues.Preview previousPreview = workflow.session().preview();
        DungeonEditorSessionValues.Preview applyPreview = workflow.applyEffect(effect);
        if (applyPreview != null) {
            applyAuthoredPreview(applyPreview, authoredCommit);
            return prepareAuthoredPreviewApplied();
        }
        if (!DungeonEditorSessionPreviewHelper.inMemoryDragPreview(effect.getPreview())) {
            return preparePublishCurrent();
        }
        if (previousPreview.equals(workflow.session().preview())) {
            return PublicationOutcome.UNCHANGED_PREVIEW_NOOP;
        }
        return prepareInMemoryPreviewPublication();
    }

    private PublicationOutcome prepareCurrentReadback() {
        snapshotBuilder.refreshAuthoredSnapshot(workflow.session());
        return PublicationOutcome.CURRENT_READBACK_PUBLISHED;
    }

    private PublicationOutcome prepareAuthoredPreviewApplied() {
        snapshotBuilder.refreshAuthoredSnapshot(workflow.session());
        return PublicationOutcome.AUTHORED_PREVIEW_APPLIED;
    }

    private PublicationOutcome prepareInMemoryPreviewPublication() {
        BuildDungeonEditorSnapshotUseCase.InMemoryPreviewRefresh refresh =
                snapshotBuilder.refreshInMemoryPreview(workflow.session());
        return refresh.directAuthoredDragPreview()
                ? PublicationOutcome.DIRECT_AUTHORED_DRAG_PREVIEW_PUBLISHED
                : PublicationOutcome.IN_MEMORY_PREVIEW_PUBLISHED;
    }

    DungeonEditorDungeonFacts currentFacts() {
        return dungeonState.currentFacts(
                workflow.session().selectedMapId(),
                workflow.session().selection(),
                workflow.session().preview());
    }

    private void applyAuthoredPreview(
            DungeonEditorSessionValues.Preview applyPreview,
            ApplyDungeonEditorSessionEffectUseCase.@Nullable AuthoredCommit authoredCommit
    ) {
        DungeonEditorWorkspaceValues.MapId mapId = workflow.session().selectedMapId();
        if (mapId != null && authoredCommit == null) {
            applyOperationUseCase.execute(mapId, applyPreview);
        }
        if (mapId != null && authoredCommit != null) {
            authoredCommit.apply(mapId);
        }
        workflow.clearPreviewWithStatus(currentFacts().mutationStatusText());
        if (DungeonEditorSessionPreviewHelper.clearsSelectionAfterApply(applyPreview)) {
            workflow.applyEffect(DungeonEditorSessionEffect.clearedSelection());
        }
    }

    enum PublicationOutcome {
        COMMITTED_GRID_AVAILABLE(false),
        PUBLISH_CURRENT(true),
        AUTHORED_PREVIEW_APPLIED(true),
        DIRECT_AUTHORED_DRAG_PREVIEW_PUBLISHED(true),
        IN_MEMORY_PREVIEW_PUBLISHED(true),
        UNCHANGED_PREVIEW_NOOP(false),
        CURRENT_READBACK_PUBLISHED(true);

        private final boolean publishesSnapshot;

        PublicationOutcome(boolean publishesSnapshot) {
            this.publishesSnapshot = publishesSnapshot;
        }

        boolean publishesSnapshot() {
            return publishesSnapshot;
        }
    }

    record CurrentGridResult(
            DungeonEditorWorkspaceValues.@Nullable MapSnapshot committedSnapshot,
            PublicationOutcome outcome
    ) {
    }
}
