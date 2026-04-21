package src.domain.dungeon.application;

import src.domain.dungeon.map.aggregate.DungeonMap;
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
    private final BuildDungeonDerivedStateUseCase derive;

    public LoadMapSnapshotUseCase(
            DungeonMapRepository repository,
            BuildDungeonDerivedStateUseCase derive
    ) {
        this.repository = repository;
        this.derive = derive;
    }

    public MapSnapshotData execute(DungeonMapIdentity mapIdentity, int targetFloor) {
        DungeonMap dungeonMap = repository.findById(mapIdentity)
                .orElseThrow(() -> new IllegalArgumentException("Unknown dungeon map: " + mapIdentity.value()));
        DungeonMapFacts map = derive.execute(dungeonMap).map();
        return new MapSnapshotData(
                dungeonMap.metadata().mapId(),
                dungeonMap.metadata().mapName(),
                dungeonMap.revision(),
                targetFloor,
                map,
                map.allCells().isEmpty()
        );
    }
}
