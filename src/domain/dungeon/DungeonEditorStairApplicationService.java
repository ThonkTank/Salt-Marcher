package src.domain.dungeon;

import java.util.Objects;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorStairGeometryUseCase;
import src.domain.dungeon.published.SaveDungeonEditorStairGeometryCommand;

public final class DungeonEditorStairApplicationService {

    private final SaveDungeonEditorStairGeometryUseCase saveStairGeometryUseCase;

    DungeonEditorStairApplicationService(
            SaveDungeonEditorStairGeometryUseCase saveStairGeometryUseCase
    ) {
        this.saveStairGeometryUseCase = Objects.requireNonNull(saveStairGeometryUseCase, "saveStairGeometryUseCase");
    }

    public void saveStairGeometry(SaveDungeonEditorStairGeometryCommand command) {
        Objects.requireNonNull(command, "command");
        saveStairGeometryUseCase.execute(new SaveDungeonEditorStairGeometryUseCase.StairGeometryInput(
                command.stairId(),
                command.shapeName(),
                command.directionName(),
                command.dimension1(),
                command.dimension2()));
    }
}
