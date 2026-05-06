package src.domain.dungeon.published;

import java.util.List;

public sealed interface DungeonMapCatalogResponse permits
        DungeonMapCatalogResponse.MapList,
        DungeonMapCatalogResponse.MapMutation {

    record MapList(List<DungeonMapSummary> maps) implements DungeonMapCatalogResponse {

        public MapList {
            maps = maps == null ? List.of() : List.copyOf(maps);
        }
    }

    record MapMutation(
            MutationKind kind,
            DungeonMapId mapId
    ) implements DungeonMapCatalogResponse {

        public MapMutation {
            kind = kind == null ? MutationKind.CREATED : kind;
            mapId = mapId == null ? new DungeonMapId(1L) : mapId;
        }
    }

    enum MutationKind {
        CREATED,
        RENAMED,
        DELETED
    }
}
