package features.world.dungeonmap.model.index;

import features.world.dungeonmap.model.DungeonArea;
import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonFeature;
import features.world.dungeonmap.model.DungeonFeatureTile;
import features.world.dungeonmap.model.DungeonLink;
import features.world.dungeonmap.model.DungeonLinkAnchor;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonSquare;

import java.util.List;
import java.util.Map;

public record DungeonMapIndex(
        Map<SquareCoordinate, DungeonSquare> squaresByCoordinate,
        Map<Long, DungeonSquare> squaresById,
        Map<Long, DungeonRoom> roomsById,
        Map<Long, DungeonArea> areasById,
        Map<Long, DungeonFeature> featuresById,
        Map<Long, DungeonEndpoint> endpointsById,
        Map<Long, DungeonPassage> passagesById,
        Map<Long, List<DungeonFeature>> featuresBySquareId,
        Map<Long, List<DungeonSquare>> squaresByRoomId,
        Map<Long, List<DungeonRoom>> roomsByAreaId,
        Map<Long, List<DungeonFeatureTile>> featureTilesByFeatureId,
        Map<Long, List<DungeonEndpoint>> endpointsByRoomId,
        Map<Long, List<DungeonPassage>> passagesByRoomId,
        Map<DungeonLinkAnchor, List<DungeonLink>> linksByAnchor
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

    public DungeonEndpoint findEndpoint(Long endpointId) {
        return endpointId == null ? null : endpointsById.get(endpointId);
    }

    public DungeonPassage findPassage(Long passageId) {
        return passageId == null ? null : passagesById.get(passageId);
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

    public List<DungeonEndpoint> endpointsForRoom(Long roomId) {
        return roomId == null ? List.of() : endpointsByRoomId.getOrDefault(roomId, List.of());
    }

    public List<DungeonPassage> passagesForRoom(Long roomId) {
        return roomId == null ? List.of() : passagesByRoomId.getOrDefault(roomId, List.of());
    }

    public List<DungeonLink> linksForAnchor(DungeonLinkAnchor anchor) {
        return anchor == null ? List.of() : linksByAnchor.getOrDefault(anchor, List.of());
    }

    public record SquareCoordinate(int x, int y) {
    }
}
