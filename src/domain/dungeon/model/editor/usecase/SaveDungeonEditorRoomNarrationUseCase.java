package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorRoomNarrationInput;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class SaveDungeonEditorRoomNarrationUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final SaveDungeonEditorAuthoredRoomNarrationUseCase saveRoomNarrationUseCase;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;

    public SaveDungeonEditorRoomNarrationUseCase(
            DungeonEditorSessionWorkflow workflow,
            SaveDungeonEditorAuthoredRoomNarrationUseCase saveRoomNarrationUseCase,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.saveRoomNarrationUseCase = Objects.requireNonNull(saveRoomNarrationUseCase, "saveRoomNarrationUseCase");
        this.effectUseCase = Objects.requireNonNull(effectUseCase, "effectUseCase");
    }

    public void execute(DungeonEditorRoomNarrationInput roomNarration) {
        if (roomNarration == null || !DungeonEditorWorkspaceValues.hasId(roomNarration.roomId())) {
            return;
        }
        if (workflow.selectedMapId() != null) {
            saveRoomNarrationUseCase.execute(workflow.selectedMapId(), roomNarration);
        }
        workflow.narrationSaved(effectUseCase.currentFacts().mutationStatusText());
        effectUseCase.publishCurrent();
    }
}
