package features.world.dungeonmap.service;

import database.DatabaseManager;
import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.DungeonMapState;
import features.world.dungeonmap.repository.DungeonAreaRepository;
import features.world.dungeonmap.repository.DungeonEndpointRepository;
import features.world.dungeonmap.repository.DungeonLinkRepository;
import features.world.dungeonmap.repository.DungeonMapRepository;
import features.world.dungeonmap.repository.DungeonPassageRepository;
import features.world.dungeonmap.repository.DungeonRoomRepository;
import features.world.dungeonmap.repository.DungeonSquareRepository;

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
                DungeonSquareRepository.getSquares(conn, mapId),
                DungeonRoomRepository.getRooms(conn, mapId),
                DungeonAreaRepository.getAreas(conn, mapId),
                DungeonEndpointRepository.getEndpoints(conn, mapId),
                DungeonLinkRepository.getLinks(conn, mapId),
                DungeonPassageRepository.getPassages(conn, mapId));
    }
}
