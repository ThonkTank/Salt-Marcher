package src.domain.dungeon;

import java.util.Objects;
import src.domain.dungeon.model.worldspace.usecase.CreateDungeonEditorMapUseCase;
import src.domain.dungeon.model.worldspace.usecase.DeleteDungeonEditorMapUseCase;
import src.domain.dungeon.model.worldspace.usecase.RenameDungeonEditorMapUseCase;
import src.domain.dungeon.model.worldspace.usecase.SelectDungeonEditorMapUseCase;
import src.domain.dungeon.published.DeleteDungeonMapCommand;
import src.domain.dungeon.published.DungeonMapCatalogCommand;
import src.domain.dungeon.published.SelectDungeonEditorMapCommand;

public final class DungeonEditorMapApplicationService {

    private static final String COMMAND_REQUIRED_MESSAGE = "command";

    private final SelectDungeonEditorMapUseCase selectMapUseCase;
    private final CreateDungeonEditorMapUseCase createMapUseCase;
    private final RenameDungeonEditorMapUseCase renameMapUseCase;
    private final DeleteDungeonEditorMapUseCase deleteMapUseCase;

    DungeonEditorMapApplicationService(
            SelectDungeonEditorMapUseCase selectMapUseCase,
            CreateDungeonEditorMapUseCase createMapUseCase,
            RenameDungeonEditorMapUseCase renameMapUseCase,
            DeleteDungeonEditorMapUseCase deleteMapUseCase
    ) {
        this.selectMapUseCase = Objects.requireNonNull(selectMapUseCase, "selectMapUseCase");
        this.createMapUseCase = Objects.requireNonNull(createMapUseCase, "createMapUseCase");
        this.renameMapUseCase = Objects.requireNonNull(renameMapUseCase, "renameMapUseCase");
        this.deleteMapUseCase = Objects.requireNonNull(deleteMapUseCase, "deleteMapUseCase");
    }

    public void selectMap(SelectDungeonEditorMapCommand command) {
        Objects.requireNonNull(command, COMMAND_REQUIRED_MESSAGE);
        selectMapUseCase.execute(command.mapId().value());
    }

    public void createMap(DungeonMapCatalogCommand.CreateMapCommand command) {
        Objects.requireNonNull(command, COMMAND_REQUIRED_MESSAGE);
        createMapUseCase.execute(command.mapName());
    }

    public void renameMap(DungeonMapCatalogCommand.RenameMapCommand command) {
        Objects.requireNonNull(command, COMMAND_REQUIRED_MESSAGE);
        renameMapUseCase.execute(command.mapId().value(), command.mapName());
    }

    public void deleteMap(DeleteDungeonMapCommand command) {
        Objects.requireNonNull(command, COMMAND_REQUIRED_MESSAGE);
        deleteMapUseCase.execute(command.mapId().value());
    }
}
