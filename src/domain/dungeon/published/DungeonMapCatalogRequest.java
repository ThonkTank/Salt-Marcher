package src.domain.dungeon.published;

public sealed interface DungeonMapCatalogRequest permits
        DungeonMapCatalogRequest.Search,
        DungeonMapCatalogRequest.CreateMap,
        DungeonMapCatalogRequest.RenameMap,
        DungeonMapCatalogRequest.DeleteMap {

    record Search(String query) implements DungeonMapCatalogRequest {

        public Search {
            query = query == null ? "" : query;
        }
    }

    record CreateMap(String mapName) implements DungeonMapCatalogRequest {

        public CreateMap {
            mapName = mapName == null ? "" : mapName;
        }
    }

    record RenameMap(
            DungeonMapId mapId,
            String mapName
    ) implements DungeonMapCatalogRequest {

        public RenameMap {
            mapId = mapId == null ? new DungeonMapId(1L) : mapId;
            mapName = mapName == null ? "" : mapName;
        }
    }

    record DeleteMap(DungeonMapId mapId) implements DungeonMapCatalogRequest {

        public DeleteMap {
            mapId = mapId == null ? new DungeonMapId(1L) : mapId;
        }
    }
}
