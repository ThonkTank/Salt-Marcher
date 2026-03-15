package features.world.dungeonmap.model.projection.index;

import features.world.dungeonmap.model.domain.DungeonConnection;
import features.world.dungeonmap.model.domain.DungeonArea;
import features.world.dungeonmap.model.domain.DungeonFeature;
import features.world.dungeonmap.model.domain.DungeonFeatureTile;
import features.world.dungeonmap.model.domain.DungeonRoom;
import features.world.dungeonmap.model.domain.DungeonSquare;

import java.util.List;
import java.util.Map;

public record DungeonMapIndex(
        Map<SquareCoordinate, DungeonSquare> squaresByCoordinate,
        Map<Long, DungeonSquare> squaresById,
        Map<Long, DungeonRoom> roomsById,
        Map<Long, DungeonArea> areasById,
        Map<Long, DungeonFeature> featuresById,
        Map<Long, DungeonConnection> connectionsById,
        Map<Long, List<DungeonFeature>> featuresBySquareId,
        Map<Long, List<DungeonSquare>> squaresByRoomId,
        Map<Long, List<DungeonRoom>> roomsByAreaId,
        Map<Long, List<DungeonFeatureTile>> featureTilesByFeatureId,
        Map<Long, List<DungeonRoomConnectionSummary>> roomConnectionsByRoomId
) {
    public static DungeonMapIndex empty() {
        return new DungeonMapIndex(
                Map.of(),
                Map.of(),
                Map.of(),
                Map.of(),
                Map.of(),
                Map.of(),
                Map.of(),
                Map.of(),
                Map.of(),
                Map.of(),
                Map.of());
    }

    public DungeonSquare squareAt(int x, int y) {
        return squaresByCoordinate.get(new SquareCoordinate(x, y));
    }

    public DungeonSquare findSquare(Long squareId) {
        return squareId == null ? null : squaresById.get(squareId);
    }

    public DungeonRoom findRoom(Long roomId) {
        return roomId == null ? null : roomsById.get(roomId);
    }

    public DungeonArea findArea(Long areaId) {
        return areaId == null ? null : areasById.get(areaId);
    }

    public DungeonFeature findFeature(Long featureId) {
        return featureId == null ? null : featuresById.get(featureId);
    }

    public DungeonConnection findConnection(Long connectionId) {
        return connectionId == null ? null : connectionsById.get(connectionId);
    }

    public List<DungeonFeature> featuresAtSquare(Long squareId) {
        return squareId == null ? List.of() : featuresBySquareId.getOrDefault(squareId, List.of());
    }

    public List<DungeonSquare> squaresForRoom(Long roomId) {
        return roomId == null ? List.of() : squaresByRoomId.getOrDefault(roomId, List.of());
    }

    public List<DungeonRoom> roomsForArea(Long areaId) {
        return areaId == null ? List.of() : roomsByAreaId.getOrDefault(areaId, List.of());
    }

    public List<DungeonFeatureTile> featureTilesForFeature(Long featureId) {
        return featureId == null ? List.of() : featureTilesByFeatureId.getOrDefault(featureId, List.of());
    }

    public List<DungeonRoomConnectionSummary> roomConnectionsForRoom(Long roomId) {
        return roomId == null ? List.of() : roomConnectionsByRoomId.getOrDefault(roomId, List.of());
    }

    public record SquareCoordinate(int x, int y) {
    }
}
