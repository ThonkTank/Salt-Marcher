package features.world.dungeonmap.service.projection;

import features.world.dungeonmap.model.domain.DungeonConnection;
import features.world.dungeonmap.model.domain.DungeonConnectionPoint;
import features.world.dungeonmap.model.domain.DungeonMap;
import features.world.dungeonmap.model.domain.DungeonSquare;
import features.world.dungeonmap.model.domain.DungeonWall;
import features.world.dungeonmap.model.projection.DungeonMapConnectionPath;
import features.world.dungeonmap.model.projection.edge.DungeonEdgeIndex;
import features.world.dungeonmap.model.projection.DungeonMapState;
import features.world.dungeonmap.model.projection.index.DungeonMapIndex;
import features.world.dungeonmap.repository.connection.DungeonConnectionPointRepository;
import features.world.dungeonmap.repository.connection.DungeonConnectionRepository;
import features.world.dungeonmap.repository.feature.DungeonAreaRepository;
import features.world.dungeonmap.repository.feature.DungeonFeatureRepository;
import features.world.dungeonmap.repository.feature.DungeonFeatureTileRepository;
import features.world.dungeonmap.repository.map.DungeonMapRepository;
import features.world.dungeonmap.repository.map.DungeonRoomRepository;
import features.world.dungeonmap.repository.map.DungeonSquareRepository;
import features.world.dungeonmap.repository.topology.DungeonWallRepository;
import features.world.dungeonmap.service.room.DungeonRoomConnectionRoutes;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public final class DungeonMapStateLoader {

    private DungeonMapStateLoader() {
        throw new AssertionError("No instances");
    }

    public static DungeonMapState load(Connection conn, long mapId) throws SQLException {
        DungeonMap map = DungeonMapRepository.findMap(conn, mapId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown dungeon map: " + mapId));
        List<DungeonSquare> squares = DungeonSquareRepository.getSquares(conn, mapId);
        List<DungeonWall> walls = DungeonWallRepository.getWalls(conn, mapId);
        List<DungeonConnection> rawConnections = DungeonConnectionRepository.getConnections(conn, mapId);
        List<DungeonConnectionPoint> rawConnectionPoints = DungeonConnectionPointRepository.getPoints(conn, mapId);
        DungeonEdgeIndex edgeIndex = DungeonEdgeSummaryBuilder.buildIndex(squares, walls);
        DungeonMapState rawState = new DungeonMapState(
                map,
                squares,
                DungeonRoomRepository.getRooms(conn, mapId),
                DungeonAreaRepository.getAreas(conn, mapId),
                DungeonFeatureRepository.getFeatures(conn, mapId),
                DungeonFeatureTileRepository.getFeatureTiles(conn, mapId),
                rawConnections,
                rawConnectionPoints,
                List.of(),
                walls,
                DungeonMapIndex.empty(),
                edgeIndex);
        DungeonMapState indexedRawState = rawState.withIndex(DungeonMapIndexBuilder.build(rawState));
        List<DungeonMapConnectionPath> roomConnections = DungeonRoomConnectionRoutes.projectConnections(indexedRawState);
        Set<Long> visibleConnectionIds = new LinkedHashSet<>();
        for (DungeonMapConnectionPath connectionPath : roomConnections) {
            if (connectionPath.connectionId() != null) {
                visibleConnectionIds.add(connectionPath.connectionId());
            }
        }
        List<DungeonConnection> connections = rawConnections.stream()
                .filter(connection -> connection.connectionId() != null && visibleConnectionIds.contains(connection.connectionId()))
                .toList();
        List<DungeonConnectionPoint> connectionPoints = rawConnectionPoints.stream()
                .filter(point -> point.connectionId() != null && visibleConnectionIds.contains(point.connectionId()))
                .toList();
        DungeonMapState filteredState = new DungeonMapState(
                map,
                squares,
                rawState.rooms(),
                rawState.areas(),
                rawState.features(),
                rawState.featureTiles(),
                connections,
                connectionPoints,
                roomConnections,
                walls,
                DungeonMapIndex.empty(),
                edgeIndex);
        return filteredState.withIndex(DungeonMapIndexBuilder.build(filteredState));
    }
}
