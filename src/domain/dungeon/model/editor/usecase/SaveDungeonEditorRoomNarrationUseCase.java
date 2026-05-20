package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionWorkflow;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorRoomNarrationInput;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.editor.repository.DungeonEditorDungeonRepository;

public final class SaveDungeonEditorRoomNarrationUseCase {
    private final DungeonEditorSessionWorkflow workflow;
    private final DungeonEditorDungeonRepository dungeonRepository;
    private final ApplyDungeonEditorSessionEffectUseCase effectUseCase;

    public SaveDungeonEditorRoomNarrationUseCase(
            DungeonEditorSessionWorkflow workflow,
            DungeonEditorDungeonRepository dungeonRepository,
            ApplyDungeonEditorSessionEffectUseCase effectUseCase
    ) {
        this.workflow = Objects.requireNonNull(workflow, "workflow");
        this.dungeonRepository = Objects.requireNonNull(dungeonRepository, "dungeonRepository");
        this.effectUseCase = Objects.requireNonNull(effectUseCase, "effectUseCase");
    }

    public void execute(DungeonEditorRoomNarrationInput roomNarration) {
        if (!DungeonEditorWorkspaceValues.hasId(roomNarration.roomId())) {
            effectUseCase.publishCurrent();
            return;
        }
        dungeonRepository.saveRoomNarration(workflow.selectedMapId(), roomNarration);
        workflow.narrationSaved(effectUseCase.currentFacts().mutationStatusText());
        effectUseCase.publishCurrent();
    }
}
