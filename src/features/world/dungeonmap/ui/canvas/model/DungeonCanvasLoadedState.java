package features.world.dungeonmap.ui.canvas.model;

import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonFeature;
import features.world.dungeonmap.model.DungeonFeatureTile;
import features.world.dungeonmap.model.DungeonLink;
import features.world.dungeonmap.model.DungeonMapState;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.model.DungeonWall;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class DungeonCanvasLoadedState {

    private final Map<String, DungeonSquare> squaresByCoord = new HashMap<>();
    private final Map<Long, DungeonRoom> roomsById = new HashMap<>();
    private final Map<Long, DungeonFeature> featuresById = new HashMap<>();
    private final Map<Long, DungeonEndpoint> endpointsById = new HashMap<>();
    private final Map<Long, DungeonPassage> passagesById = new HashMap<>();
    private final Map<Long, DungeonLink> linksById = new HashMap<>();
    private final Map<String, DungeonWall> baseWallsByEdge = new HashMap<>();
    private final Map<String, DungeonPassage> basePassagesByEdge = new HashMap<>();
    private final Map<String, List<DungeonFeatureTile>> featureTilesByCoord = new HashMap<>();
    private final Map<Long, List<DungeonFeatureTile>> featureTilesByFeatureId = new HashMap<>();

    private DungeonMapState state;
    private Long loadedMapId;
    private Integer loadedMapWidth;
    private Integer loadedMapHeight;

    public boolean loadState(DungeonMapState nextState) {
        Long previousMapId = loadedMapId;
        Integer previousWidth = loadedMapWidth;
        Integer previousHeight = loadedMapHeight;

        state = nextState;
        squaresByCoord.clear();
        roomsById.clear();
        featuresById.clear();
        endpointsById.clear();
        passagesById.clear();
        linksById.clear();
        baseWallsByEdge.clear();
        basePassagesByEdge.clear();
        featureTilesByCoord.clear();
        featureTilesByFeatureId.clear();

        if (nextState == null || nextState.map() == null) {
            loadedMapId = null;
            loadedMapWidth = null;
            loadedMapHeight = null;
            return true;
        }

        for (DungeonSquare square : nextState.squares()) {
            squaresByCoord.put(key(square.x(), square.y()), square);
        }
        for (DungeonRoom room : nextState.rooms()) {
            roomsById.put(room.roomId(), room);
        }
        for (DungeonEndpoint endpoint : nextState.endpoints()) {
            endpointsById.put(endpoint.endpointId(), endpoint);
        }
        for (DungeonFeature feature : nextState.features()) {
            featuresById.put(feature.featureId(), feature);
        }
        for (DungeonPassage passage : nextState.passages()) {
            if (passage.passageId() != null) {
                passagesById.put(passage.passageId(), passage);
            }
        }
        for (DungeonLink link : nextState.links()) {
            linksById.put(link.linkId(), link);
        }
        for (DungeonWall wall : nextState.walls()) {
            baseWallsByEdge.put(wall.edgeKey(), wall);
        }
        for (DungeonPassage passage : nextState.passages()) {
            basePassagesByEdge.put(passage.edgeKey(), passage);
        }
        for (DungeonFeatureTile tile : nextState.featureTiles()) {
            featureTilesByCoord.computeIfAbsent(key(tile.x(), tile.y()), ignored -> new java.util.ArrayList<>()).add(tile);
            featureTilesByFeatureId.computeIfAbsent(tile.featureId(), ignored -> new java.util.ArrayList<>()).add(tile);
        }

        loadedMapId = nextState.map().mapId();
        loadedMapWidth = nextState.map().width();
        loadedMapHeight = nextState.map().height();
        return previousMapId == null
                || !previousMapId.equals(loadedMapId)
                || previousWidth == null
                || previousHeight == null
                || !previousWidth.equals(loadedMapWidth)
                || !previousHeight.equals(loadedMapHeight);
    }

    public DungeonMapState state() {
        return state;
    }

    public Map<String, DungeonSquare> squaresByCoord() {
        return squaresByCoord;
    }

    public DungeonSquare squareAt(int x, int y) {
        return squaresByCoord.get(key(x, y));
    }

    public Map<Long, DungeonRoom> roomsById() {
        return roomsById;
    }

    public Map<Long, DungeonFeature> featuresById() {
        return featuresById;
    }

    public Map<Long, DungeonEndpoint> endpointsById() {
        return endpointsById;
    }

    public Map<Long, DungeonPassage> passagesById() {
        return passagesById;
    }

    public Map<Long, DungeonLink> linksById() {
        return linksById;
    }

    public Map<String, DungeonWall> baseWallsByEdge() {
        return baseWallsByEdge;
    }

    public Map<String, DungeonPassage> basePassagesByEdge() {
        return basePassagesByEdge;
    }

    public Map<String, List<DungeonFeatureTile>> featureTilesByCoord() {
        return featureTilesByCoord;
    }

    public Map<Long, List<DungeonFeatureTile>> featureTilesByFeatureId() {
        return featureTilesByFeatureId;
    }

    public String resolveRoomName(Long roomId) {
        DungeonRoom room = roomId == null ? null : roomsById.get(roomId);
        return room == null ? null : room.name();
    }

    private static String key(int x, int y) {
        return x + ":" + y;
    }
}
