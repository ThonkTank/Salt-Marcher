package src.domain.dungeon.published;

public sealed interface DungeonMapCatalogCommand permits
        DungeonMapCatalogCommand.Search,
        DungeonMapCatalogCommand.CreateMap,
        DungeonMapCatalogCommand.RenameMap,
        DeleteDungeonMapCommand {

    int SEARCH_OPERATION = 1;
    int CREATE_OPERATION = 2;
    int RENAME_OPERATION = 3;
    int DELETE_OPERATION = 4;

    int operationKey();

    String query();

    long mapIdValue();

    String mapName();

    record Search(String query) implements DungeonMapCatalogCommand {

        public Search {
            query = query == null ? "" : query;
        }

        @Override
        public int operationKey() {
            return SEARCH_OPERATION;
        }

        @Override
        public String query() {
            return query;
        }

        @Override
        public long mapIdValue() {
            return 1L;
        }

        @Override
        public String mapName() {
            return "";
        }
    }

    record CreateMap(String mapName) implements DungeonMapCatalogCommand {

        public CreateMap {
            mapName = mapName == null ? "" : mapName;
        }

        @Override
        public int operationKey() {
            return CREATE_OPERATION;
        }

        @Override
        public String query() {
            return "";
        }

        @Override
        public long mapIdValue() {
            return 1L;
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
        public int operationKey() {
            return RENAME_OPERATION;
        }

        @Override
        public String query() {
            return "";
        }

        @Override
        public long mapIdValue() {
            return mapId.value();
        }
    }

}
