package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorDungeonFacts;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorDungeonState;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;

public final class ApplyDungeonEditorSessionEffectUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final BuildDungeonEditorSnapshotUseCase snapshotBuilder;
    private final PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase;
    private final DungeonEditorPreviewLifecycleUseCase previewLifecycle;

    public ApplyDungeonEditorSessionEffectUseCase(
            DungeonEditorSessionWorkflow workflow,
            ApplyDungeonEditorAuthoredOperationUseCase applyOperationUseCase,
            DungeonEditorDungeonState dungeonState,
            BuildDungeonEditorSnapshotUseCase snapshotBuilder,
            PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.snapshotBuilder = Objects.requireNonNull(snapshotBuilder, "snapshotBuilder");
        this.snapshotPublicationUseCase =
                Objects.requireNonNull(snapshotPublicationUseCase, "snapshotPublicationUseCase");
        previewLifecycle = new DungeonEditorPreviewLifecycleUseCase(
                this.workflow,
                applyOperationUseCase,
                dungeonState,
                this.snapshotBuilder);
    }

    public DungeonEditorWorkspaceValues.@Nullable MapSnapshot loadCommittedSnapshot() {
        return snapshotBuilder.loadCommittedSnapshot(workflow.session().selectedMapId());
    }

    public DungeonEditorSessionSnapshot.@Nullable SnapshotData publishCurrent() {
        return publish(previewLifecycle.preparePublishCurrent());
    }

    public DungeonEditorWorkspaceValues.@Nullable MapSnapshot committedGridOrPublishCurrent() {
        return committedGridOrPublishCurrentResult().committedSnapshot();
    }

    public CurrentGridPublication committedGridOrPublishCurrentResult() {
        DungeonEditorPreviewLifecycleUseCase.CurrentGridResult result =
                previewLifecycle.committedGridOrCurrentFallback();
        return new CurrentGridPublication(result.committedSnapshot(), publish(result.outcome()));
    }

    public DungeonEditorSessionSnapshot.@Nullable SnapshotData applyEffect(
            DungeonEditorSessionEffect effect,
            @Nullable AuthoredCommit authoredCommit
    ) {
        return publish(previewLifecycle.applyEffect(effect, authoredCommit));
    }

    public DungeonEditorDungeonFacts currentFacts() {
        return previewLifecycle.currentFacts();
    }

    private DungeonEditorSessionSnapshot.@Nullable SnapshotData publish(
            DungeonEditorPreviewLifecycleUseCase.PublicationOutcome outcome
    ) {
        if (!outcome.publishesSnapshot()) {
            return null;
        }
        DungeonEditorSessionSnapshot.SnapshotData snapshot =
                workflow.reconcileSnapshot(snapshotBuilder.execute(workflow.session()));
        if (outcome.controlsOnly()) {
            snapshotPublicationUseCase.executeControlsSnapshot(snapshot);
            return snapshot;
        }
        snapshotPublicationUseCase.execute(snapshot);
        return snapshot;
    }

    @FunctionalInterface
    public interface AuthoredCommit {
        void apply(DungeonEditorWorkspaceValues.MapId mapId);
    }

    public record CurrentGridPublication(
            DungeonEditorWorkspaceValues.@Nullable MapSnapshot committedSnapshot,
            DungeonEditorSessionSnapshot.@Nullable SnapshotData snapshot
    ) {
    }

}
