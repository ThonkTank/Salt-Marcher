package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorMainViewPointerTarget;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.MainViewInput;

public final class ApplyDungeonEditorDeleteFeatureMarkerUseCase {
    private static final long NO_MARKER_ID = 0L;

    private final DungeonEditorSessionWorkflow workflow;
    private final DeleteDungeonEditorAuthoredFeatureMarkerUseCase deleteFeatureMarkerUseCase;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;
    private final BuildDungeonEditorMainViewInputUseCase inputBuilder =
            new BuildDungeonEditorMainViewInputUseCase();

    public ApplyDungeonEditorDeleteFeatureMarkerUseCase(
            DungeonEditorSessionWorkflow workflow,
            DeleteDungeonEditorAuthoredFeatureMarkerUseCase deleteFeatureMarkerUseCase,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.deleteFeatureMarkerUseCase = Objects.requireNonNull(deleteFeatureMarkerUseCase, "deleteFeatureMarkerUseCase");
        this.effectUseCase = Objects.requireNonNull(effectUseCase, "effectUseCase");
    }

    public void press(MainViewInput input) {
        if (!workflow.session().hasSelectedMap()) {
            effectUseCase.publishCurrent();
            return;
        }
        long markerId = markerId(input);
        if (markerId <= NO_MARKER_ID) {
            effectUseCase.publishCurrent();
            return;
        }
        boolean deleted = deleteFeatureMarkerUseCase.execute(workflow.session().selectedMapId(), markerId);
        if (deleted) {
            workflow.applyEffect(DungeonEditorMainViewEffect.clearedSelection());
            workflow.clearPreviewWithStatus(effectUseCase.currentFacts().mutationStatusText());
        }
        effectUseCase.publishCurrent();
    }

    private long markerId(MainViewInput input) {
        DungeonEditorMainViewPointerTarget target = inputBuilder.execute(input).target();
        DungeonTopologyRef topologyRef = target.topologyRef();
        if (topologyRef.kind() == DungeonTopologyElementKind.FEATURE_MARKER) {
            return topologyRef.id();
        }
        return NO_MARKER_ID;
    }
}
