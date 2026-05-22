package src.domain.dungeon.published;

public sealed interface DungeonMapCatalogCommand permits
        DungeonMapCatalogCommand.CreateMapCommand,
        DungeonMapCatalogCommand.RenameMapCommand,
        DeleteDungeonMapCommand {

    record CreateMapCommand(String mapName) implements DungeonMapCatalogCommand {

        public CreateMapCommand {
            mapName = mapName == null ? "" : mapName;
        }
    }

    record RenameMapCommand(
            DungeonMapId mapId,
            String mapName
    ) implements DungeonMapCatalogCommand {

        public RenameMapCommand {
            mapId = mapId == null ? new DungeonMapId(1L) : mapId;
            mapName = mapName == null ? "" : mapName;
        }
    }

}
