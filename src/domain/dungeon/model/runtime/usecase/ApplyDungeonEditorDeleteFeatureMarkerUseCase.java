package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;

public final class ApplyDungeonEditorDeleteFeatureMarkerUseCase {
    private static final long NO_MARKER_ID = 0L;

    private final DungeonEditorSessionWorkflow workflow;
    private final DeleteDungeonEditorAuthoredFeatureMarkerUseCase deleteFeatureMarkerUseCase;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;

    public ApplyDungeonEditorDeleteFeatureMarkerUseCase(
            DungeonEditorSessionWorkflow workflow,
            DeleteDungeonEditorAuthoredFeatureMarkerUseCase deleteFeatureMarkerUseCase,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.deleteFeatureMarkerUseCase = Objects.requireNonNull(deleteFeatureMarkerUseCase, "deleteFeatureMarkerUseCase");
        this.effectUseCase = Objects.requireNonNull(effectUseCase, "effectUseCase");
    }

    public void press(DungeonTopologyRef target) {
        if (!workflow.session().hasSelectedMap()) {
            effectUseCase.publishCurrent();
            return;
        }
        long markerId = markerId(target);
        if (markerId <= NO_MARKER_ID) {
            effectUseCase.publishCurrent();
            return;
        }
        boolean deleted = deleteFeatureMarkerUseCase.execute(workflow.session().selectedMapId(), markerId);
        if (deleted) {
            workflow.applyEffect(DungeonEditorSessionEffect.clearedSelection());
            workflow.clearPreviewWithStatus(effectUseCase.currentFacts().mutationStatusText());
        }
        effectUseCase.publishCurrent();
    }

    private long markerId(DungeonTopologyRef target) {
        DungeonTopologyRef safeTarget = target == null ? DungeonTopologyRef.empty() : target;
        if (safeTarget.kind() == DungeonTopologyElementKind.FEATURE_MARKER) {
            return safeTarget.id();
        }
        return NO_MARKER_ID;
    }
}
