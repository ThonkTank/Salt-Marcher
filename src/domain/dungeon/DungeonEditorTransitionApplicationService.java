package src.domain.dungeon;

import java.util.Objects;
import src.domain.dungeon.model.worldspace.usecase.SaveDungeonEditorTransitionDescriptionUseCase;
import src.domain.dungeon.model.worldspace.usecase.SaveDungeonEditorTransitionLinkUseCase;
import src.domain.dungeon.published.SaveDungeonEditorTransitionDescriptionCommand;
import src.domain.dungeon.published.SaveDungeonEditorTransitionLinkCommand;

public final class DungeonEditorTransitionApplicationService {

    private final SaveDungeonEditorTransitionDescriptionUseCase saveTransitionDescriptionUseCase;
    private final SaveDungeonEditorTransitionLinkUseCase saveTransitionLinkUseCase;

    DungeonEditorTransitionApplicationService(
            SaveDungeonEditorTransitionDescriptionUseCase saveTransitionDescriptionUseCase,
            SaveDungeonEditorTransitionLinkUseCase saveTransitionLinkUseCase
    ) {
        this.saveTransitionDescriptionUseCase = Objects.requireNonNull(
                saveTransitionDescriptionUseCase,
                "saveTransitionDescriptionUseCase");
        this.saveTransitionLinkUseCase = Objects.requireNonNull(
                saveTransitionLinkUseCase,
                "saveTransitionLinkUseCase");
    }

    public void saveTransitionDescription(SaveDungeonEditorTransitionDescriptionCommand command) {
        Objects.requireNonNull(command, "command");
        saveTransitionDescriptionUseCase.execute(
                new SaveDungeonEditorTransitionDescriptionUseCase.TransitionDescriptionInput(
                        command.transitionId(),
                        command.description()));
    }

    public void saveTransitionLink(SaveDungeonEditorTransitionLinkCommand command) {
        Objects.requireNonNull(command, "command");
        saveTransitionLinkUseCase.execute(new SaveDungeonEditorTransitionLinkUseCase.TransitionLinkInput(
                command.sourceTransitionId(),
                command.targetMapId(),
                command.targetTransitionId(),
                command.bidirectional()));
    }
}
