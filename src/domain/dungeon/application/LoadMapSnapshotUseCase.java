package src.domain.dungeon.application;

import src.domain.dungeon.published.BaseMapSnapshot;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.dungeon.published.LoadMapSnapshotQuery;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.port.DungeonDocumentRepository;
import src.domain.dungeon.map.port.DungeonMapRepository;

/**
 * Loads the snapshot for one authored map and carries the requested viewport through.
 */
public final class LoadMapSnapshotUseCase {

    private final DungeonMapRepository repository;
    private final DungeonDocumentRepository documentStore;
    private final BuildDungeonDerivedStateUseCase derive;
    private final MapDungeonFactsUseCase mapper = new MapDungeonFactsUseCase();

    public LoadMapSnapshotUseCase(
            DungeonMapRepository repository,
            DungeonDocumentRepository documentStore,
            BuildDungeonDerivedStateUseCase derive
    ) {
        this.repository = repository;
        this.documentStore = documentStore;
        this.derive = derive;
    }

    public BaseMapSnapshot execute(LoadMapSnapshotQuery query) {
        var mapIdentity = mapper.toDomainIdentity(query.mapId());
        DungeonMap dungeonMap = repository.findById(mapIdentity)
                .orElseThrow(() -> new IllegalArgumentException("Unknown dungeon map: " + query.mapId().value()));
        documentStore.activateMap(mapIdentity, dungeonMap.metadata().mapName());
        var document = documentStore.load(mapIdentity, dungeonMap.metadata().mapName());
        DungeonMapSnapshot map = mapper.toPublishedSnapshot(derive.execute(document).map());
        return new BaseMapSnapshot(
                mapper.toPublishedId(dungeonMap.metadata().mapId()),
                dungeonMap.metadata().mapName(),
                document.revision(),
                query.targetFloor(),
                map,
                map.allCells().isEmpty()
        );
    }
}
