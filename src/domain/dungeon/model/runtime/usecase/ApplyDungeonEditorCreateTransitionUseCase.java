package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.transition.TransitionDestination;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;

public final class ApplyDungeonEditorCreateTransitionUseCase {
    private static final String INVALID_TRANSITION_DESTINATION_STATUS = "Uebergangsziel ungueltig.";
    private final DungeonEditorSessionWorkflow workflow;
    private final CreateDungeonEditorAuthoredTransitionUseCase createTransitionUseCase;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;

    public ApplyDungeonEditorCreateTransitionUseCase(
            DungeonEditorSessionWorkflow workflow,
            CreateDungeonEditorAuthoredTransitionUseCase createTransitionUseCase,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.createTransitionUseCase = Objects.requireNonNull(createTransitionUseCase, "createTransitionUseCase");
        this.effectUseCase = Objects.requireNonNull(effectUseCase, "effectUseCase");
    }

    public void press(Cell anchor, @Nullable TransitionDestination destination) {
        if (!workflow.session().hasSelectedMap() || anchor == null) {
            effectUseCase.publishCurrent();
            return;
        }
        if (!createTransitionUseCase.canExecute(workflow.session().selectedMapId(), anchor, destination)) {
            workflow.clearPreviewWithStatus(INVALID_TRANSITION_DESTINATION_STATUS);
            effectUseCase.publishCurrent();
            return;
        }
        createTransitionUseCase.execute(workflow.session().selectedMapId(), anchor, destination);
        workflow.clearPreviewWithStatus(effectUseCase.currentFacts().mutationStatusText());
        effectUseCase.publishCurrent();
    }

}
