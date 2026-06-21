package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;

public final class ApplyDungeonEditorDeleteStairUseCase {
    private static final long NO_STAIR_ID = 0L;

    private final DungeonEditorSessionWorkflow workflow;
    private final DeleteDungeonEditorAuthoredStairUseCase deleteStairUseCase;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;

    public ApplyDungeonEditorDeleteStairUseCase(
            DungeonEditorSessionWorkflow workflow,
            DeleteDungeonEditorAuthoredStairUseCase deleteStairUseCase,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.deleteStairUseCase = Objects.requireNonNull(deleteStairUseCase, "deleteStairUseCase");
        this.effectUseCase = Objects.requireNonNull(effectUseCase, "effectUseCase");
    }

    public void press(DungeonTopologyRef target) {
        if (!workflow.session().hasSelectedMap()) {
            effectUseCase.publishCurrent();
            return;
        }
        long stairId = stairId(target);
        if (stairId <= NO_STAIR_ID) {
            effectUseCase.publishCurrent();
            return;
        }
        boolean deleted = deleteStairUseCase.execute(workflow.session().selectedMapId(), stairId);
        if (deleted) {
            workflow.applyEffect(DungeonEditorSessionEffect.clearedSelection());
            workflow.clearPreviewWithStatus(effectUseCase.currentFacts().mutationStatusText());
        }
        effectUseCase.publishCurrent();
    }

    private long stairId(DungeonTopologyRef target) {
        DungeonTopologyRef safeTarget = target == null ? DungeonTopologyRef.empty() : target;
        if (safeTarget.kind() == DungeonTopologyElementKind.STAIR) {
            return safeTarget.id();
        }
        return NO_STAIR_ID;
    }
}
