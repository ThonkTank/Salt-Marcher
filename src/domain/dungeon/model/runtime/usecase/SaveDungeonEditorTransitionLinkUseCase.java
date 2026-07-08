package src.domain.dungeon.model.runtime.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionWorkflow;

public final class SaveDungeonEditorTransitionLinkUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final SaveDungeonEditorAuthoredTransitionLinkUseCase saveTransitionLinkUseCase;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;

    public SaveDungeonEditorTransitionLinkUseCase(
            DungeonEditorSessionWorkflow workflow,
            SaveDungeonEditorAuthoredTransitionLinkUseCase saveTransitionLinkUseCase,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.saveTransitionLinkUseCase = Objects.requireNonNull(
                saveTransitionLinkUseCase,
                "saveTransitionLinkUseCase");
        this.effectUseCase = Objects.requireNonNull(effectUseCase, "effectUseCase");
    }

    public ApplyDungeonEditorOperationUseCase.@Nullable OperationResultData execute(TransitionLinkInput input) {
        TransitionLinkInput safeInput = input == null ? TransitionLinkInput.empty() : input;
        if (!workflow.session().hasSelectedMap()) {
            return null;
        }
        ApplyDungeonEditorOperationUseCase.OperationResultData result = saveTransitionLinkUseCase.execute(
                workflow.session().selectedMapId(),
                safeInput.sourceTransitionId(),
                safeInput.targetMapId(),
                safeInput.targetTransitionId(),
                safeInput.bidirectional());
        if (result == null) {
            return null;
        }
        workflow.clearPreviewWithStatus(effectUseCase.currentFacts().mutationStatusText());
        effectUseCase.publishCurrent();
        return result;
    }

    public record TransitionLinkInput(
            long sourceTransitionId,
            long targetMapId,
            long targetTransitionId,
            boolean bidirectional
    ) {
        public TransitionLinkInput {
            sourceTransitionId = Math.max(0L, sourceTransitionId);
            targetMapId = Math.max(0L, targetMapId);
            targetTransitionId = Math.max(0L, targetTransitionId);
        }

        static TransitionLinkInput empty() {
            return new TransitionLinkInput(0L, 0L, 0L, false);
        }
    }
}
