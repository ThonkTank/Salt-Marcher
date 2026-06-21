package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;

public final class ApplyDungeonEditorDeleteTransitionUseCase {
    private static final long NO_TRANSITION_ID = 0L;

    private final DungeonEditorSessionWorkflow workflow;
    private final DeleteDungeonEditorAuthoredTransitionUseCase deleteTransitionUseCase;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;

    public ApplyDungeonEditorDeleteTransitionUseCase(
            DungeonEditorSessionWorkflow workflow,
            DeleteDungeonEditorAuthoredTransitionUseCase deleteTransitionUseCase,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.deleteTransitionUseCase = Objects.requireNonNull(deleteTransitionUseCase, "deleteTransitionUseCase");
        this.effectUseCase = Objects.requireNonNull(effectUseCase, "effectUseCase");
    }

    public void press(DungeonTopologyRef target) {
        if (!workflow.session().hasSelectedMap()) {
            effectUseCase.publishCurrent();
            return;
        }
        long transitionId = transitionId(target);
        if (transitionId <= NO_TRANSITION_ID) {
            effectUseCase.publishCurrent();
            return;
        }
        boolean deleted = deleteTransitionUseCase.execute(workflow.session().selectedMapId(), transitionId);
        if (deleted) {
            workflow.applyEffect(DungeonEditorSessionEffect.clearedSelection());
            workflow.clearPreviewWithStatus(effectUseCase.currentFacts().mutationStatusText());
        }
        effectUseCase.publishCurrent();
    }

    private long transitionId(DungeonTopologyRef target) {
        DungeonTopologyRef safeTarget = target == null ? DungeonTopologyRef.empty() : target;
        if (safeTarget.kind() == DungeonTopologyElementKind.TRANSITION) {
            return safeTarget.id();
        }
        return NO_TRANSITION_ID;
    }
}
