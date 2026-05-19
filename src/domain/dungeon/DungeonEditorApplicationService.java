package src.domain.dungeon;

import java.util.Objects;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionCommand;
import src.domain.dungeon.model.editor.usecase.ApplyDungeonEditorSessionUseCase;

public final class DungeonEditorApplicationService {

    private final ApplyDungeonEditorSessionUseCase applyDungeonEditorSessionUseCase;

    public DungeonEditorApplicationService(ApplyDungeonEditorSessionUseCase applyDungeonEditorSessionUseCase) {
        this.applyDungeonEditorSessionUseCase =
                Objects.requireNonNull(applyDungeonEditorSessionUseCase, "applyDungeonEditorSessionUseCase");
    }

    public void applyEditorSession(DungeonEditorSessionCommand command) {
        applyDungeonEditorSessionUseCase.apply(Objects.requireNonNull(command, "command"));
    }
}
