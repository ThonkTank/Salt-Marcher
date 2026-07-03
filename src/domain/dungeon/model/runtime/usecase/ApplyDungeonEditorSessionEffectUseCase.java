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
        return publish(previewLifecycle.preparePublishCurrent()).snapshot();
    }

    public DungeonEditorWorkspaceValues.@Nullable MapSnapshot committedGridOrPublishCurrent() {
        return committedGridOrPublishCurrentResult().committedSnapshot();
    }

    public CurrentGridPublication committedGridOrPublishCurrentResult() {
        DungeonEditorPreviewLifecycleUseCase.CurrentGridResult result =
                previewLifecycle.committedGridOrCurrentFallback();
        return new CurrentGridPublication(result.committedSnapshot(), publish(result.outcome()).snapshot());
    }

    public PublicationResult applyEffect(
            DungeonEditorSessionEffect effect,
            @Nullable AuthoredCommit authoredCommit
    ) {
        return publish(previewLifecycle.applyEffect(effect, authoredCommit));
    }

    public DungeonEditorDungeonFacts currentFacts() {
        return previewLifecycle.currentFacts();
    }

    private PublicationResult publish(
            DungeonEditorPreviewLifecycleUseCase.PublicationOutcome outcome
    ) {
        if (!outcome.publishesSnapshot()) {
            return PublicationResult.none();
        }
        if (outcome.controlsOnly()) {
            DungeonEditorSessionSnapshot.ControlsData controls =
                    DungeonEditorSessionSnapshot.controlsData(workflow.session());
            snapshotPublicationUseCase.executeControls(controls);
            return PublicationResult.controls(controls);
        }
        DungeonEditorSessionSnapshot.SnapshotData snapshot =
                workflow.reconcileSnapshot(snapshotBuilder.execute(workflow.session()));
        snapshotPublicationUseCase.execute(snapshot);
        return PublicationResult.full(snapshot);
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

    public enum PublicationKind {
        NONE,
        FULL_SNAPSHOT,
        CONTROLS
    }

    public record PublicationResult(
            PublicationKind kind,
            DungeonEditorSessionSnapshot.@Nullable SnapshotData snapshot,
            DungeonEditorSessionSnapshot.@Nullable ControlsData controls
    ) {
        public PublicationResult {
            kind = Objects.requireNonNull(kind, "kind");
            switch (kind) {
                case NONE -> {
                    if (snapshot != null || controls != null) {
                        throw new IllegalArgumentException("NONE publication cannot carry snapshot or controls");
                    }
                }
                case FULL_SNAPSHOT -> {
                    if (snapshot == null || controls != null) {
                        throw new IllegalArgumentException("FULL_SNAPSHOT publication requires snapshot only");
                    }
                }
                case CONTROLS -> {
                    if (snapshot != null || controls == null) {
                        throw new IllegalArgumentException("CONTROLS publication requires controls only");
                    }
                }
            }
        }

        public static PublicationResult none() {
            return new PublicationResult(PublicationKind.NONE, null, null);
        }

        public static PublicationResult full(DungeonEditorSessionSnapshot.SnapshotData snapshot) {
            return new PublicationResult(PublicationKind.FULL_SNAPSHOT, snapshot, null);
        }

        public static PublicationResult controls(DungeonEditorSessionSnapshot.ControlsData controls) {
            return new PublicationResult(PublicationKind.CONTROLS, null, controls);
        }
    }

}
