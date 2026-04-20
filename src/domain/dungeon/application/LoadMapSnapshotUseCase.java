package src.domain.dungeon.application;

import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.port.DungeonDocumentRepository;
import src.domain.dungeon.map.port.DungeonMapRepository;
import src.domain.dungeon.map.value.DungeonMapFacts;
import src.domain.dungeon.map.value.DungeonMapIdentity;

/**
 * Loads the snapshot for one authored map and carries the requested viewport through.
 */
public final class LoadMapSnapshotUseCase {

    public record MapSnapshotData(
            DungeonMapIdentity mapId,
            String mapName,
            long revision,
            int targetFloor,
            DungeonMapFacts map,
            boolean empty
    ) {
    }

    private final DungeonMapRepository repository;
    private final DungeonDocumentRepository documentStore;
    private final BuildDungeonDerivedStateUseCase derive;

    public LoadMapSnapshotUseCase(
            DungeonMapRepository repository,
            DungeonDocumentRepository documentStore,
            BuildDungeonDerivedStateUseCase derive
    ) {
        this.repository = repository;
        this.documentStore = documentStore;
        this.derive = derive;
    }

    public MapSnapshotData execute(DungeonMapIdentity mapIdentity, int targetFloor) {
        DungeonMap dungeonMap = repository.findById(mapIdentity)
                .orElseThrow(() -> new IllegalArgumentException("Unknown dungeon map: " + mapIdentity.value()));
        documentStore.activateMap(mapIdentity, dungeonMap.metadata().mapName());
        var document = documentStore.load(mapIdentity, dungeonMap.metadata().mapName());
        DungeonMapFacts map = derive.execute(document).map();
        return new MapSnapshotData(
                dungeonMap.metadata().mapId(),
                dungeonMap.metadata().mapName(),
                document.revision(),
                targetFloor,
                map,
                map.allCells().isEmpty()
        );
    }
}
