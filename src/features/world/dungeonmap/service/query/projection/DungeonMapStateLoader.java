package features.world.dungeonmap.service.query.projection;

import features.world.dungeonmap.model.domain.DungeonMap;
import features.world.dungeonmap.model.domain.DungeonPassage;
import features.world.dungeonmap.model.domain.DungeonSquare;
import features.world.dungeonmap.model.domain.DungeonWall;
import features.world.dungeonmap.model.projection.edge.DungeonEdgeIndex;
import features.world.dungeonmap.model.projection.edge.DungeonEdgeSummaryBuilder;
import features.world.dungeonmap.model.projection.DungeonMapState;
import features.world.dungeonmap.model.projection.index.DungeonMapIndex;
import features.world.dungeonmap.model.projection.index.DungeonMapIndexBuilder;
import features.world.dungeonmap.repository.connection.DungeonEndpointRepository;
import features.world.dungeonmap.repository.connection.DungeonLinkRepository;
import features.world.dungeonmap.repository.connection.DungeonPassageRepository;
import features.world.dungeonmap.repository.feature.DungeonAreaRepository;
import features.world.dungeonmap.repository.feature.DungeonFeatureRepository;
import features.world.dungeonmap.repository.feature.DungeonFeatureTileRepository;
import features.world.dungeonmap.repository.map.DungeonMapRepository;
import features.world.dungeonmap.repository.map.DungeonRoomRepository;
import features.world.dungeonmap.repository.map.DungeonSquareRepository;
import features.world.dungeonmap.repository.topology.DungeonWallRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;

public final class DungeonMapStateLoader {

    private DungeonMapStateLoader() {
        throw new AssertionError("No instances");
    }

    public static DungeonMapState load(Connection conn, long mapId) throws SQLException {
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
