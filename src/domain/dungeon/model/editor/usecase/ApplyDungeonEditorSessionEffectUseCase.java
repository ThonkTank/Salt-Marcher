package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewEffect;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonFacts;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionSnapshot;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.editor.port.DungeonEditorDungeonPort;
import src.domain.dungeon.model.editor.repository.DungeonEditorDungeonRepository;

public final class ApplyDungeonEditorSessionEffectUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final DungeonEditorDungeonRepository dungeonRepository;
    private final DungeonEditorDungeonPort dungeonPort;
    private final BuildDungeonEditorSnapshotUseCase snapshotBuilder;
    private final PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase;

    public ApplyDungeonEditorSessionEffectUseCase(
            DungeonEditorSessionWorkflow workflow,
            DungeonEditorDungeonRepository dungeonRepository,
            DungeonEditorDungeonPort dungeonPort,
            BuildDungeonEditorSnapshotUseCase snapshotBuilder,
            PublishDungeonEditorSnapshotUseCase snapshotPublicationUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.dungeonRepository = Objects.requireNonNull(dungeonRepository, "dungeonRepository");
        this.dungeonPort = Objects.requireNonNull(dungeonPort, "dungeonPort");
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
            dungeonRepository.applyOperation(workflow.selectedMapId(), applyPreview);
            workflow.clearPreviewWithStatus(currentFacts().mutationStatusText());
        }
        publishCurrent();
    }

    DungeonEditorDungeonFacts currentFacts() {
        return dungeonPort.currentFacts(
                workflow.selectedMapId(),
                workflow.selection(),
                workflow.preview());
    }
}
