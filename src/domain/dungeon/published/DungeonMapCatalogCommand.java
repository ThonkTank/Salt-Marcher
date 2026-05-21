package src.domain.dungeon.published;

public sealed interface DungeonMapCatalogCommand permits
        DungeonMapCatalogCommand.Search,
        DungeonMapCatalogCommand.CreateMap,
        DungeonMapCatalogCommand.RenameMap,
        DeleteDungeonMapCommand {

    String SEARCH = "search";
    String CREATE = "create";
    String RENAME = "rename";
    String DELETE = "delete";

    default String actionKey() {
        return "";
    }

    default String query() {
        return "";
    }

    default long mapIdValue() {
        return 1L;
    }

    default String mapName() {
        return "";
    }

    record Search(String query) implements DungeonMapCatalogCommand {

        public Search {
            query = query == null ? "" : query;
        }

        @Override
        public String actionKey() {
            return SEARCH;
        }
    }

    record CreateMap(String mapName) implements DungeonMapCatalogCommand {

        public CreateMap {
            mapName = mapName == null ? "" : mapName;
        }

        @Override
        public String actionKey() {
            return CREATE;
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

        @Override
        public String actionKey() {
            return RENAME;
        }

        @Override
        public long mapIdValue() {
            return mapId.value();
        }
    }

}
