package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewEffect;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonFacts;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonState;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

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

    DungeonEditorWorkspaceValues.@Nullable MapSnapshot loadCommittedSnapshot() {
        return snapshotBuilder.loadCommittedSnapshot(workflow.selectedMapId());
    }

    DungeonEditorSessionSnapshot.SnapshotData currentSnapshot() {
        return workflow.reconcileSnapshot(snapshotBuilder.execute(workflow.session()));
    }

    public void publishCurrent() {
        snapshotPublicationUseCase.execute(currentSnapshot());
    }

    void applyCommittedGrid(Function<DungeonEditorWorkspaceValues.MapSnapshot, DungeonEditorMainViewEffect> effectFactory) {
        DungeonEditorWorkspaceValues.MapSnapshot committedSnapshot = loadCommittedSnapshot();
        if (!workflow.canUseGridMap(committedSnapshot)) {
            publishCurrent();
            return;
        }
        applyEffect(effectFactory.apply(committedSnapshot));
    }

    void applyEffect(DungeonEditorMainViewEffect effect) {
        DungeonEditorSessionValues.Preview applyPreview = workflow.applyEffect(effect);
        if (applyPreview != null) {
            if (workflow.selectedMapId() != null) {
                applyOperationUseCase.execute(workflow.selectedMapId(), applyPreview);
            }
            workflow.clearPreviewWithStatus(currentFacts().mutationStatusText());
        }
        publishCurrent();
    }

    DungeonEditorDungeonFacts currentFacts() {
        return dungeonState.currentFacts(
                workflow.selectedMapId(),
                workflow.selection(),
                workflow.preview());
    }
}
