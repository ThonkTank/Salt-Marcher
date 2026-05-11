package src.domain.dungeon.published;

public sealed interface DungeonMapCatalogCommand permits
        DungeonMapCatalogCommand.Search,
        DungeonMapCatalogCommand.CreateMap,
        DungeonMapCatalogCommand.RenameMap,
        DungeonAuthoredReadCommand.MapSelection {

    record Search(String query) implements DungeonMapCatalogCommand {

        public Search {
            query = query == null ? "" : query;
        }
    }

    record CreateMap(String mapName) implements DungeonMapCatalogCommand {

        public CreateMap {
            mapName = mapName == null ? "" : mapName;
        }
    }

    record RenameMap(
            DungeonMapId mapId,
            String mapName
    ) implements DungeonMapCatalogCommand {

        public RenameMap {
            mapId = mapId == null ? new DungeonMapId(1L) : mapId;
            mapName = mapName == null ? "" : mapName;
        }
    }

}
