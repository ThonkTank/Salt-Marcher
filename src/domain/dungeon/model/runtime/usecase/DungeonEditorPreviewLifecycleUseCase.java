package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorDungeonFacts;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorDungeonState;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSession;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.runtime.helper.DungeonEditorSessionPreviewHelper;

final class DungeonEditorPreviewLifecycleUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final ApplyDungeonEditorSessionEffectUseCase.AuthoredPreviewCommitter authoredPreviewCommitter;
    private final DungeonEditorDungeonState dungeonState;
    private final BuildDungeonEditorSnapshotUseCase snapshotBuilder;

    DungeonEditorPreviewLifecycleUseCase(
            DungeonEditorSessionWorkflow workflow,
            ApplyDungeonEditorSessionEffectUseCase.AuthoredPreviewCommitter authoredPreviewCommitter,
            DungeonEditorDungeonState dungeonState,
            BuildDungeonEditorSnapshotUseCase snapshotBuilder
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.authoredPreviewCommitter =
                Objects.requireNonNull(authoredPreviewCommitter, "authoredPreviewCommitter");
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
        if (effect == null || effect.isNoop()) {
            return PublicationOutcome.UNCHANGED_PREVIEW_NOOP;
        }
        DungeonEditorSession previousSession = workflow.session();
        DungeonEditorSessionValues.Preview previousPreview = previousSession.preview();
        DungeonEditorSessionValues.Preview applyPreview = workflow.applyEffect(effect);
        if (applyPreview != null) {
            applyAuthoredPreview(applyPreview, authoredCommit);
            return prepareAuthoredPreviewApplied();
        }
        if (onlyStatusChanged(previousSession, workflow.session())) {
            return PublicationOutcome.STATUS_ONLY_CONTROLS_PUBLISHED;
        }
        if (!DungeonEditorSessionPreviewHelper.inMemoryDragPreview(effect.getPreview())) {
            return preparePublishCurrent();
        }
        if (previousPreview.equals(workflow.session().preview())) {
            return PublicationOutcome.UNCHANGED_PREVIEW_NOOP;
        }
        return prepareInMemoryPreviewPublication();
    }

    private static boolean onlyStatusChanged(
            DungeonEditorSession previousSession,
            DungeonEditorSession currentSession
    ) {
        return !Objects.equals(previousSession.statusText(), currentSession.statusText())
                && previousSession.withStatusText(currentSession.statusText()).equals(currentSession);
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
            authoredPreviewCommitter.apply(mapId, applyPreview);
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
        COMMITTED_GRID_AVAILABLE(PublicationChannel.NONE),
        PUBLISH_CURRENT(PublicationChannel.FULL),
        AUTHORED_PREVIEW_APPLIED(PublicationChannel.FULL),
        DIRECT_AUTHORED_DRAG_PREVIEW_PUBLISHED(PublicationChannel.FULL),
        IN_MEMORY_PREVIEW_PUBLISHED(PublicationChannel.FULL),
        STATUS_ONLY_CONTROLS_PUBLISHED(PublicationChannel.CONTROLS),
        UNCHANGED_PREVIEW_NOOP(PublicationChannel.NONE),
        CURRENT_READBACK_PUBLISHED(PublicationChannel.FULL);

        private final PublicationChannel publicationChannel;

        PublicationOutcome(PublicationChannel publicationChannel) {
            this.publicationChannel = publicationChannel;
        }

        boolean publishesSnapshot() {
            return publicationChannel != PublicationChannel.NONE;
        }

        boolean controlsOnly() {
            return publicationChannel == PublicationChannel.CONTROLS;
        }
    }

    private enum PublicationChannel {
        NONE,
        CONTROLS,
        FULL
    }

    record CurrentGridResult(
            DungeonEditorWorkspaceValues.@Nullable MapSnapshot committedSnapshot,
            PublicationOutcome outcome
    ) {
    }
}
