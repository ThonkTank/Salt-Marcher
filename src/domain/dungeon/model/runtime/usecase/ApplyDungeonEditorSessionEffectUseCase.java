package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorDungeonFacts;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorDungeonState;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
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

    public void publishCurrent() {
        publish(previewLifecycle.preparePublishCurrent());
    }

    public DungeonEditorWorkspaceValues.@Nullable MapSnapshot committedGridOrPublishCurrent() {
        DungeonEditorPreviewLifecycleUseCase.CurrentGridResult result =
                previewLifecycle.committedGridOrCurrentFallback();
        publish(result.outcome());
        return result.committedSnapshot();
    }

    public void applyEffect(DungeonEditorSessionEffect effect, @Nullable AuthoredCommit authoredCommit) {
        publish(previewLifecycle.applyEffect(effect, authoredCommit));
    }

    public DungeonEditorDungeonFacts currentFacts() {
        return previewLifecycle.currentFacts();
    }

    private void publish(DungeonEditorPreviewLifecycleUseCase.PublicationOutcome outcome) {
        if (!outcome.publishesSnapshot()) {
            return;
        }
        snapshotPublicationUseCase.execute(workflow.reconcileSnapshot(snapshotBuilder.execute(workflow.session())));
    }

    @FunctionalInterface
    public interface AuthoredCommit {
        void apply(DungeonEditorWorkspaceValues.MapId mapId);
    }

}
