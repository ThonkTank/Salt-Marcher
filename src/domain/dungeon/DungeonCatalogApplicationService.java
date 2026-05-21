package src.domain.dungeon;

import java.util.Objects;
import src.domain.dungeon.model.map.usecase.PublishDungeonMapCatalogCreateUseCase;
import src.domain.dungeon.model.map.usecase.PublishDungeonMapCatalogDeleteUseCase;
import src.domain.dungeon.model.map.usecase.PublishDungeonMapCatalogRenameUseCase;
import src.domain.dungeon.model.map.usecase.PublishDungeonMapCatalogSearchUseCase;
import src.domain.dungeon.published.DeleteDungeonMapCommand;
import src.domain.dungeon.published.DungeonMapCatalogCommand;

/**
 * Public authored-dungeon backend boundary for map catalog work.
 */
public final class DungeonCatalogApplicationService {

    private final PublishDungeonMapCatalogSearchUseCase searchUseCase;
    private final PublishDungeonMapCatalogCreateUseCase createUseCase;
    private final PublishDungeonMapCatalogRenameUseCase renameUseCase;
    private final PublishDungeonMapCatalogDeleteUseCase deleteUseCase;

    public DungeonCatalogApplicationService(
            PublishDungeonMapCatalogSearchUseCase searchUseCase,
            PublishDungeonMapCatalogCreateUseCase createUseCase,
            PublishDungeonMapCatalogRenameUseCase renameUseCase,
            PublishDungeonMapCatalogDeleteUseCase deleteUseCase
    ) {
        this.searchUseCase = Objects.requireNonNull(searchUseCase, "searchUseCase");
        this.createUseCase = Objects.requireNonNull(createUseCase, "createUseCase");
        this.renameUseCase = Objects.requireNonNull(renameUseCase, "renameUseCase");
        this.deleteUseCase = Objects.requireNonNull(deleteUseCase, "deleteUseCase");
    }

    public void search(DungeonMapCatalogCommand.SearchCommand command) {
        Objects.requireNonNull(command, "command");
        searchUseCase.execute(command.query());
    }

    public void createMap(DungeonMapCatalogCommand.CreateMapCommand command) {
        Objects.requireNonNull(command, "command");
        createUseCase.execute(command.mapName());
    }

    public void renameMap(DungeonMapCatalogCommand.RenameMapCommand command) {
        Objects.requireNonNull(command, "command");
        renameUseCase.execute(command.mapId().value(), command.mapName());
    }

    public void deleteMap(DeleteDungeonMapCommand command) {
        Objects.requireNonNull(command, "command");
        deleteUseCase.execute(command.mapId().value());
    }
}
