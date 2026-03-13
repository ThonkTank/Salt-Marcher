package features.world.dungeonmap.service;

import database.DatabaseManager;
import features.world.dungeonmap.model.projection.DungeonMapState;
import features.world.dungeonmap.model.domain.DungeonMap;
import features.world.dungeonmap.repository.map.DungeonMapRepository;
import features.world.dungeonmap.service.projection.DungeonMapStateLoader;

import java.sql.Connection;
import java.util.List;

public final class DungeonMapQueryService {

    public List<DungeonMap> getAllMaps() throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            return DungeonMapRepository.getAllMaps(conn);
        }
    }

    public DungeonMapState loadMapState(long mapId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            return DungeonMapStateLoader.load(conn, mapId);
        }
    }
}
