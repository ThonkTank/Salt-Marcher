package src.domain.dungeon.model.worldspace.usecase;

import java.util.Objects;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;

public final class SaveDungeonEditorTransitionDescriptionUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final SaveDungeonEditorAuthoredTransitionDescriptionUseCase saveTransitionDescriptionUseCase;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;

    public SaveDungeonEditorTransitionDescriptionUseCase(
            DungeonEditorSessionWorkflow workflow,
            SaveDungeonEditorAuthoredTransitionDescriptionUseCase saveTransitionDescriptionUseCase,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.saveTransitionDescriptionUseCase =
                Objects.requireNonNull(saveTransitionDescriptionUseCase, "saveTransitionDescriptionUseCase");
        this.effectUseCase = Objects.requireNonNull(effectUseCase, "effectUseCase");
    }

    public void execute(TransitionDescriptionInput input) {
        TransitionDescriptionInput safeInput = input == null ? TransitionDescriptionInput.empty() : input;
        if (safeInput.transitionId() <= 0L || !workflow.session().hasSelectedMap()) {
            return;
        }
        saveTransitionDescriptionUseCase.execute(
                workflow.session().selectedMapId(),
                safeInput.transitionId(),
                safeInput.description());
        workflow.clearPreviewWithStatus(effectUseCase.currentFacts().mutationStatusText());
        effectUseCase.publishCurrent();
    }

    public record TransitionDescriptionInput(long transitionId, String description) {
        public TransitionDescriptionInput {
            transitionId = Math.max(0L, transitionId);
            description = description == null ? "" : description;
        }

        static TransitionDescriptionInput empty() {
            return new TransitionDescriptionInput(0L, "");
        }
    }
}
