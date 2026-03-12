package features.world.dungeonmap.service;

import database.DatabaseManager;
import features.world.dungeonmap.model.DungeonMap;
import features.world.dungeonmap.model.DungeonMapState;
import features.world.dungeonmap.model.DungeonEdgeSummary;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonWall;
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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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
        List<DungeonWall> walls = DungeonWallRepository.getWalls(conn, mapId);
        List<DungeonPassage> passages = DungeonPassageRepository.getPassages(conn, mapId);
        return new DungeonMapState(
                map,
                DungeonSquareRepository.getSquares(conn, mapId),
                DungeonRoomRepository.getRooms(conn, mapId),
                DungeonAreaRepository.getAreas(conn, mapId),
                DungeonFeatureRepository.getFeatures(conn, mapId),
                DungeonFeatureTileRepository.getFeatureTiles(conn, mapId),
                DungeonEndpointRepository.getEndpoints(conn, mapId),
                DungeonLinkRepository.getLinks(conn, mapId),
                walls,
                passages,
                buildEdges(walls, passages));
    }

    private static List<DungeonEdgeSummary> buildEdges(List<DungeonWall> walls, List<DungeonPassage> passages) {
        Map<String, DungeonEdgeSummary> edgesByKey = new LinkedHashMap<>();
        for (DungeonWall wall : walls) {
            edgesByKey.put(wall.edgeKey(), new DungeonEdgeSummary(
                    wall.x(),
                    wall.y(),
                    wall.direction(),
                    wall,
                    null));
        }
        for (DungeonPassage passage : passages) {
            DungeonEdgeSummary existing = edgesByKey.get(passage.edgeKey());
            if (existing == null) {
                edgesByKey.put(passage.edgeKey(), new DungeonEdgeSummary(
                        passage.x(),
                        passage.y(),
                        passage.direction(),
                        null,
                        passage));
                continue;
            }
            edgesByKey.put(passage.edgeKey(), new DungeonEdgeSummary(
                    existing.x(),
                    existing.y(),
                    existing.direction(),
                    existing.wall(),
                    passage));
        }
        return new ArrayList<>(edgesByKey.values());
    }
}
