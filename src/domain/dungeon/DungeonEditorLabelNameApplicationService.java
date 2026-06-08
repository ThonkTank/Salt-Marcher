package src.domain.dungeon;

import java.util.Objects;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorLabelNameUseCase;
import src.domain.dungeon.published.SaveDungeonEditorLabelNameCommand;

public final class DungeonEditorLabelNameApplicationService {

    private final SaveDungeonEditorLabelNameUseCase saveLabelNameUseCase;

    DungeonEditorLabelNameApplicationService(SaveDungeonEditorLabelNameUseCase saveLabelNameUseCase) {
        this.saveLabelNameUseCase = Objects.requireNonNull(saveLabelNameUseCase, "saveLabelNameUseCase");
    }

    public void saveLabelName(SaveDungeonEditorLabelNameCommand command) {
        Objects.requireNonNull(command, "command");
        saveLabelNameUseCase.execute(new SaveDungeonEditorLabelNameUseCase.LabelNameInput(
                command.targetKind(),
                command.targetId(),
                command.name()));
    }
}
