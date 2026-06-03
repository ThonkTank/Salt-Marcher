package src.domain.dungeon.model.worldspace.usecase;

import java.util.Objects;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorMainViewPointerTarget;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.runtime.usecase.ApplyDungeonEditorSessionEffectUseCase;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase.MainViewInput;
import src.domain.dungeon.model.runtime.usecase.BuildDungeonEditorMainViewInputUseCase;
import src.domain.dungeon.model.worldspace.DungeonTopologyElementKind;
import src.domain.dungeon.model.worldspace.DungeonTopologyRef;

public final class ApplyDungeonEditorDeleteTransitionUseCase {
    private static final long NO_TRANSITION_ID = 0L;

    private final DungeonEditorSessionWorkflow workflow;
    private final DeleteDungeonEditorAuthoredTransitionUseCase deleteTransitionUseCase;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;
    private final BuildDungeonEditorMainViewInputUseCase inputBuilder =
            new BuildDungeonEditorMainViewInputUseCase();

    public ApplyDungeonEditorDeleteTransitionUseCase(
            DungeonEditorSessionWorkflow workflow,
            DeleteDungeonEditorAuthoredTransitionUseCase deleteTransitionUseCase,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.deleteTransitionUseCase = Objects.requireNonNull(deleteTransitionUseCase, "deleteTransitionUseCase");
        this.effectUseCase = Objects.requireNonNull(effectUseCase, "effectUseCase");
    }

    public void press(MainViewInput input) {
        if (!workflow.session().hasSelectedMap()) {
            effectUseCase.publishCurrent();
            return;
        }
        long transitionId = transitionId(input);
        if (transitionId <= NO_TRANSITION_ID) {
            effectUseCase.publishCurrent();
            return;
        }
        boolean deleted = deleteTransitionUseCase.execute(workflow.session().selectedMapId(), transitionId);
        if (deleted) {
            workflow.applyEffect(DungeonEditorMainViewEffect.clearedSelection());
            workflow.clearPreviewWithStatus(effectUseCase.currentFacts().mutationStatusText());
        }
        effectUseCase.publishCurrent();
    }

    private long transitionId(MainViewInput input) {
        DungeonEditorMainViewPointerTarget target = inputBuilder.execute(input).target();
        DungeonTopologyRef topologyRef = target.topologyRef();
        if (topologyRef.kind() == DungeonTopologyElementKind.TRANSITION) {
            return topologyRef.id();
        }
        return NO_TRANSITION_ID;
    }
}
