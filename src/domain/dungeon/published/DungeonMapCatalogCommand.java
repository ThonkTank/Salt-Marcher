package src.domain.dungeon.published;

public sealed interface DungeonMapCatalogCommand permits
        DungeonMapCatalogCommand.SearchCommand,
        DungeonMapCatalogCommand.CreateMapCommand,
        DungeonMapCatalogCommand.RenameMapCommand,
        DeleteDungeonMapCommand {

    record SearchCommand(String query) implements DungeonMapCatalogCommand {

        public SearchCommand {
            query = query == null ? "" : query;
        }
    }

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
