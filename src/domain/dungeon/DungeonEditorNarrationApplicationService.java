package src.domain.dungeon;

import java.util.ArrayList;
import java.util.Objects;
import src.domain.dungeon.model.runtime.usecase.SaveDungeonEditorRoomNarrationUseCase;
import src.domain.dungeon.published.SaveDungeonEditorRoomNarrationCommand;

public final class DungeonEditorNarrationApplicationService {

    private final SaveDungeonEditorRoomNarrationUseCase saveRoomNarrationUseCase;

    DungeonEditorNarrationApplicationService(
            SaveDungeonEditorRoomNarrationUseCase saveRoomNarrationUseCase
    ) {
        this.saveRoomNarrationUseCase = Objects.requireNonNull(
                saveRoomNarrationUseCase,
                "saveRoomNarrationUseCase");
    }

    public void saveRoomNarration(SaveDungeonEditorRoomNarrationCommand command) {
        Objects.requireNonNull(command, "command");
        java.util.List<SaveDungeonEditorRoomNarrationUseCase.ExitInput> exits =
                new ArrayList<>(command.exits().size());
        for (int index = 0; index < command.exits().size(); index++) {
            exits.add(new SaveDungeonEditorRoomNarrationUseCase.ExitInput(
                    command.exits().get(index).label(),
                    command.exits().get(index).q(),
                    command.exits().get(index).r(),
                    command.exits().get(index).level(),
                    command.exits().get(index).direction(),
                    command.exits().get(index).description()));
        }
        saveRoomNarrationUseCase.execute(new SaveDungeonEditorRoomNarrationUseCase.RoomNarrationInput(
                command.roomId(),
                command.visualDescription(),
                exits));
    }
}
