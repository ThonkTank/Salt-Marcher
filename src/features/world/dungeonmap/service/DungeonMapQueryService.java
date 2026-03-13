package features.world.dungeonmap.service;

import database.DatabaseManager;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.DungeonMapState;
import features.world.dungeonmap.model.DungeonEdgeIndex;
import features.world.dungeonmap.model.DungeonEdgeSummaryBuilder;
import features.world.dungeonmap.model.DungeonWall;
import features.world.dungeonmap.model.index.DungeonMapIndex;
import features.world.dungeonmap.model.index.DungeonMapIndexBuilder;
import features.world.dungeonmap.repository.DungeonAreaRepository;
import features.world.dungeonmap.repository.DungeonEndpointRepository;
import features.world.dungeonmap.repository.DungeonFeatureRepository;
import features.world.dungeonmap.repository.DungeonFeatureTileRepository;
import features.world.dungeonmap.repository.DungeonLinkRepository;
import features.world.dungeonmap.repository.DungeonMapRepository;
import features.world.dungeonmap.repository.DungeonPassageRepository;
import features.world.dungeonmap.repository.DungeonRoomRepository;
import features.world.dungeonmap.repository.DungeonSquareRepository;
import features.world.dungeonmap.repository.DungeonWallRepository;

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
        List<DungeonSquare> squares = DungeonSquareRepository.getSquares(conn, mapId);
        List<DungeonWall> walls = DungeonWallRepository.getWalls(conn, mapId);
        List<DungeonPassage> passages = DungeonPassageRepository.getPassages(conn, mapId);
        DungeonEdgeIndex edgeIndex = DungeonEdgeSummaryBuilder.buildIndex(squares, walls, passages);
        DungeonMapState state = new DungeonMapState(
                map,
                squares,
                DungeonRoomRepository.getRooms(conn, mapId),
                DungeonAreaRepository.getAreas(conn, mapId),
                DungeonFeatureRepository.getFeatures(conn, mapId),
                DungeonFeatureTileRepository.getFeatureTiles(conn, mapId),
                DungeonEndpointRepository.getEndpoints(conn, mapId),
                DungeonLinkRepository.getLinks(conn, mapId),
                walls,
                passages,
                DungeonMapIndex.empty(),
                edgeIndex);
        return state.withIndex(DungeonMapIndexBuilder.build(state));
    }
}
