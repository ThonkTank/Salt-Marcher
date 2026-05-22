package src.domain.dungeon;

import java.util.Objects;
import src.domain.dungeon.model.map.usecase.PublishDungeonMapCatalogCreateUseCase;
import src.domain.dungeon.model.map.usecase.PublishDungeonMapCatalogDeleteUseCase;
import src.domain.dungeon.model.map.usecase.PublishDungeonMapCatalogRenameUseCase;
import src.domain.dungeon.published.DeleteDungeonMapCommand;
import src.domain.dungeon.published.DungeonMapCatalogCommand;

/**
 * Public authored-dungeon backend boundary for map catalog work.
 */
public final class DungeonCatalogApplicationService {

    private static final String COMMAND_REQUIRED_MESSAGE = "command";

    private final PublishDungeonMapCatalogCreateUseCase createUseCase;
    private final PublishDungeonMapCatalogRenameUseCase renameUseCase;
    private final PublishDungeonMapCatalogDeleteUseCase deleteUseCase;

    public DungeonCatalogApplicationService(
            PublishDungeonMapCatalogCreateUseCase createUseCase,
            PublishDungeonMapCatalogRenameUseCase renameUseCase,
            PublishDungeonMapCatalogDeleteUseCase deleteUseCase
    ) {
        this.createUseCase = Objects.requireNonNull(createUseCase, "createUseCase");
        this.renameUseCase = Objects.requireNonNull(renameUseCase, "renameUseCase");
        this.deleteUseCase = Objects.requireNonNull(deleteUseCase, "deleteUseCase");
    }

    public void createMap(DungeonMapCatalogCommand.CreateMapCommand command) {
        Objects.requireNonNull(command, COMMAND_REQUIRED_MESSAGE);
        createUseCase.execute(command.mapName());
    }

    public void renameMap(DungeonMapCatalogCommand.RenameMapCommand command) {
        Objects.requireNonNull(command, COMMAND_REQUIRED_MESSAGE);
        renameUseCase.execute(command.mapId().value(), command.mapName());
    }

    public void deleteMap(DeleteDungeonMapCommand command) {
        Objects.requireNonNull(command, COMMAND_REQUIRED_MESSAGE);
        deleteUseCase.execute(command.mapId().value());
    }
}
