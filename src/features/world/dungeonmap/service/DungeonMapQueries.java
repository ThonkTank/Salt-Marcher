package features.world.dungeonmap.service;

import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.DungeonMapState;

import java.util.List;

public final class DungeonMapQueries {

    public List<DungeonMap> getAllMaps() throws Exception {
        return DungeonMapQueryService.getAllMaps();
    }

    public DungeonMapState loadMapState(long mapId) throws Exception {
        return DungeonMapQueryService.loadMapState(mapId);
    }
}
