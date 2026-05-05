package src.domain.dungeon.application;

import src.domain.dungeon.map.aggregate.DungeonMap;
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

    private final LoadDungeonMapUseCase loadDungeonMap;
    private final BuildDungeonDerivedStateUseCase derive;

    public LoadMapSnapshotUseCase(
            LoadDungeonMapUseCase loadDungeonMap,
            BuildDungeonDerivedStateUseCase derive
    ) {
        this.loadDungeonMap = loadDungeonMap;
        this.derive = derive;
    }

    public MapSnapshotData execute(DungeonMapIdentity mapIdentity, int targetFloor) {
        DungeonMap dungeonMap = loadDungeonMap.require(mapIdentity);
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
