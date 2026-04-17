package src.domain.dungeon.usecase;

import src.domain.dungeon.api.BaseMapSnapshot;
import src.domain.dungeon.api.LoadMapSnapshotQuery;
import src.domain.dungeon.entity.DungeonMap;
import src.domain.dungeon.repository.DungeonMapRepository;
import src.domain.mapcore.api.MapRenderPayload;
import src.domain.mapcore.api.MapSurfaceSnapshot;

/**
 * Loads the snapshot for one authored map and carries the requested viewport through.
 */
public final class LoadMapSnapshotUseCase {

    private final DungeonMapRepository repository;
    private final DungeonDocumentStore documentStore;
    private final BuildDungeonDerivedStateUseCase derive;

    public LoadMapSnapshotUseCase(
            DungeonMapRepository repository,
            DungeonDocumentStore documentStore,
            BuildDungeonDerivedStateUseCase derive
    ) {
        this.repository = repository;
        this.documentStore = documentStore;
        this.derive = derive;
    }

    public BaseMapSnapshot execute(LoadMapSnapshotQuery query) {
        DungeonMap dungeonMap = repository.findById(query.mapId())
                .orElseThrow(() -> new IllegalArgumentException("Unknown dungeon map: " + query.mapId().value()));
        documentStore.activateMap(query.mapId(), dungeonMap.metadata().mapName());
        var document = documentStore.load(query.mapId(), dungeonMap.metadata().mapName());
        MapSurfaceSnapshot surface = derive.execute(document).surface();
        return new BaseMapSnapshot(
                dungeonMap.metadata().mapId(),
                dungeonMap.metadata().mapName(),
                document.revision(),
                query.targetFloor(),
                query.onionConfig(),
                query.viewport(),
                toRenderPayload(surface),
                surface.allCells().isEmpty(),
                surface.selectableTargets()
        );
    }

    private MapRenderPayload toRenderPayload(MapSurfaceSnapshot surface) {
        return new MapRenderPayload(
                surface.topology(),
                surface.allCells(),
                surface.edges()
        );
    }
}
