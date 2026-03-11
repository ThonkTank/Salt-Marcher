package features.world.dungeonmap.service;

import database.DatabaseManager;
import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.DungeonMapState;
import features.world.dungeonmap.repository.DungeonMapRepository;

import java.sql.Connection;
import java.util.List;

public final class DungeonMapQueryService {

    private DungeonMapQueryService() {
        throw new AssertionError("No instances");
    }

    public static List<DungeonMap> getAllMaps() throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            return DungeonMapRepository.getAllMaps(conn);
        }
    }

    public static DungeonMapState loadMapState(long mapId) throws Exception {
        try (Connection conn = DatabaseManager.getConnection()) {
            return loadMapState(conn, mapId);
        }
    }

    static DungeonMapState loadMapState(Connection conn, long mapId) throws Exception {
        DungeonMap map = DungeonMapRepository.findMap(conn, mapId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown dungeon map: " + mapId));
        return new DungeonMapState(
                map,
                DungeonMapRepository.getSquares(conn, mapId),
                DungeonMapRepository.getRooms(conn, mapId),
                DungeonMapRepository.getAreas(conn, mapId),
                DungeonMapRepository.getEndpoints(conn, mapId),
                DungeonMapRepository.getLinks(conn, mapId));
    }
}
