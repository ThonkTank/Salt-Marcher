package src.domain.dungeon.model.map.usecase;

import java.util.List;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;

public final class ApplyDungeonMapCatalogUseCase {

    public record MapCatalogResult(List<SearchDungeonMapsUseCase.MapSummary> maps) {
        public MapCatalogResult {
            maps = maps == null ? List.of() : List.copyOf(maps);
        }
    }

    private final SearchDungeonMapsUseCase searchDungeonMapsUseCase;
    private final CreateDungeonMapUseCase createDungeonMapUseCase;
    private final RenameDungeonMapUseCase renameDungeonMapUseCase;
    private final DeleteDungeonMapUseCase deleteDungeonMapUseCase;

    public ApplyDungeonMapCatalogUseCase(
            SearchDungeonMapsUseCase searchDungeonMapsUseCase,
            CreateDungeonMapUseCase createDungeonMapUseCase,
            RenameDungeonMapUseCase renameDungeonMapUseCase,
            DeleteDungeonMapUseCase deleteDungeonMapUseCase
    ) {
        this.searchDungeonMapsUseCase = Objects.requireNonNull(searchDungeonMapsUseCase, "searchDungeonMapsUseCase");
        this.createDungeonMapUseCase = Objects.requireNonNull(createDungeonMapUseCase, "createDungeonMapUseCase");
        this.renameDungeonMapUseCase = Objects.requireNonNull(renameDungeonMapUseCase, "renameDungeonMapUseCase");
        this.deleteDungeonMapUseCase = Objects.requireNonNull(deleteDungeonMapUseCase, "deleteDungeonMapUseCase");
    }

    public MapCatalogResult search(String query) {
        return new MapCatalogResult(searchDungeonMapsUseCase.execute(query));
    }

    public DungeonMapIdentity createMap(String mapName) {
        return createDungeonMapUseCase.execute(mapName).mapId();
    }

    public DungeonMapIdentity renameMap(@Nullable DungeonMapIdentity mapId, String mapName) {
        return renameDungeonMapUseCase.execute(effectiveId(mapId), mapName).mapId();
    }

    public DungeonMapIdentity deleteMap(@Nullable DungeonMapIdentity mapId) {
        return deleteDungeonMapUseCase.execute(effectiveId(mapId));
    }

    private static DungeonMapIdentity effectiveId(@Nullable DungeonMapIdentity mapId) {
        return mapId == null ? new DungeonMapIdentity(1L) : mapId;
    }
}
