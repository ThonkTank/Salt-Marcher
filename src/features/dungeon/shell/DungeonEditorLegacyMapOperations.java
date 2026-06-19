package src.features.dungeon.shell;

import java.util.Objects;
import src.domain.dungeon.DungeonEditorMapApplicationService;
import src.domain.dungeon.published.DeleteDungeonMapCommand;
import src.domain.dungeon.published.DungeonMapCatalogCommand;
import src.domain.dungeon.published.SelectDungeonEditorMapCommand;

record DungeonEditorLegacyMapOperations(
        DungeonEditorMapApplicationService mapEditor
) {
    DungeonEditorLegacyMapOperations {
        Objects.requireNonNull(mapEditor, "mapEditor");
    }

    void selectMap(SelectDungeonEditorMapCommand command) {
        mapEditor.selectMap(command);
    }

    void createMap(DungeonMapCatalogCommand.CreateMapCommand command) {
        mapEditor.createMap(command);
    }

    void renameMap(DungeonMapCatalogCommand.RenameMapCommand command) {
        mapEditor.renameMap(command);
    }

    void deleteMap(DeleteDungeonMapCommand command) {
        mapEditor.deleteMap(command);
    }
}
