package src.domain.dungeon.usecase;

import src.domain.dungeon.api.BaseMapSnapshot;
import src.domain.dungeon.api.LoadMapSnapshotQuery;
import src.domain.dungeon.entity.DungeonMap;
import src.domain.dungeon.repository.DungeonMapRepository;
import src.domain.mapcore.api.MapRenderPayload;

/**
 * Loads the viewport-scoped snapshot for one authored map.
 */
public final class LoadMapSnapshotUseCase {

    private final DungeonMapRepository repository;

    public LoadMapSnapshotUseCase(DungeonMapRepository repository) {
        this.repository = repository;
    }

    public BaseMapSnapshot execute(LoadMapSnapshotQuery query) {
        DungeonMap dungeonMap = repository.findById(query.mapId())
                .orElseThrow(() -> new IllegalArgumentException("Unknown dungeon map: " + query.mapId().value()));
        return new BaseMapSnapshot(
                dungeonMap.metadata().mapId(),
                dungeonMap.metadata().mapName(),
                dungeonMap.revision(),
                0,
                query.onionConfig(),
                query.viewport(),
                MapRenderPayload.empty(),
                true
        );
    }
}
