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

public final class ApplyDungeonEditorDeleteStairUseCase {
    private static final long NO_STAIR_ID = 0L;

    private final DungeonEditorSessionWorkflow workflow;
    private final DeleteDungeonEditorAuthoredStairUseCase deleteStairUseCase;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;
    private final BuildDungeonEditorMainViewInputUseCase inputBuilder =
            new BuildDungeonEditorMainViewInputUseCase();

    public ApplyDungeonEditorDeleteStairUseCase(
            DungeonEditorSessionWorkflow workflow,
            DeleteDungeonEditorAuthoredStairUseCase deleteStairUseCase,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.deleteStairUseCase = Objects.requireNonNull(deleteStairUseCase, "deleteStairUseCase");
        this.effectUseCase = Objects.requireNonNull(effectUseCase, "effectUseCase");
    }

    public void press(MainViewInput input) {
        if (!workflow.session().hasSelectedMap()) {
            effectUseCase.publishCurrent();
            return;
        }
        long stairId = stairId(input);
        if (stairId <= NO_STAIR_ID) {
            effectUseCase.publishCurrent();
            return;
        }
        boolean deleted = deleteStairUseCase.execute(workflow.session().selectedMapId(), stairId);
        if (deleted) {
            workflow.applyEffect(DungeonEditorMainViewEffect.clearedSelection());
            workflow.clearPreviewWithStatus(effectUseCase.currentFacts().mutationStatusText());
        }
        effectUseCase.publishCurrent();
    }

    private long stairId(MainViewInput input) {
        DungeonEditorMainViewPointerTarget target = inputBuilder.execute(input).target();
        DungeonTopologyRef topologyRef = target.topologyRef();
        if (topologyRef.kind() == DungeonTopologyElementKind.STAIR) {
            return topologyRef.id();
        }
        return NO_STAIR_ID;
    }
}
