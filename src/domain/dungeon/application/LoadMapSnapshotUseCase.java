package src.domain.dungeon.application;

import src.domain.dungeon.published.BaseMapSnapshot;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.dungeon.published.LoadMapSnapshotQuery;
import src.domain.dungeon.map.DungeonMap;
import src.domain.dungeon.map.DungeonMapRepository;

/**
 * Loads the snapshot for one authored map and carries the requested viewport through.
 */
final class LoadMapSnapshotUseCase {

    private final DungeonMapRepository repository;
    private final DungeonDocumentStore documentStore;
    private final BuildDungeonDerivedStateUseCase derive;

    LoadMapSnapshotUseCase(
            DungeonMapRepository repository,
            DungeonDocumentStore documentStore,
            BuildDungeonDerivedStateUseCase derive
    ) {
        this.repository = repository;
        this.documentStore = documentStore;
        this.derive = derive;
    }

    BaseMapSnapshot execute(LoadMapSnapshotQuery query) {
        DungeonMap dungeonMap = repository.findById(query.mapId())
                .orElseThrow(() -> new IllegalArgumentException("Unknown dungeon map: " + query.mapId().value()));
        documentStore.activateMap(query.mapId(), dungeonMap.metadata().mapName());
        var document = documentStore.load(query.mapId(), dungeonMap.metadata().mapName());
        DungeonMapSnapshot map = derive.execute(document).map();
        return new BaseMapSnapshot(
                dungeonMap.metadata().mapId(),
                dungeonMap.metadata().mapName(),
                document.revision(),
                query.targetFloor(),
                query.onionConfig(),
                query.viewport(),
                map,
                map.allCells().isEmpty()
        );
    }
}
