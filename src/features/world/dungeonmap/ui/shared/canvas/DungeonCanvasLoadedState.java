package features.world.dungeonmap.ui.shared.canvas;

import features.world.dungeonmap.model.domain.DungeonConnection;
import features.world.dungeonmap.model.domain.DungeonFeature;
import features.world.dungeonmap.model.domain.DungeonFeatureTile;
import features.world.dungeonmap.model.projection.DungeonMapConnectionPath;
import features.world.dungeonmap.model.projection.DungeonMapState;
import features.world.dungeonmap.model.domain.DungeonRoom;
import features.world.dungeonmap.model.domain.DungeonSquare;
import features.world.dungeonmap.model.domain.DungeonWall;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

final class DungeonCanvasLoadedState {

    private final Map<String, DungeonSquare> squaresByCoord = new HashMap<>();
    private final Map<Long, DungeonRoom> roomsById = new HashMap<>();
    private final Map<Long, DungeonFeature> featuresById = new HashMap<>();
    private final Map<Long, DungeonConnection> connectionsById = new HashMap<>();
    private final Map<String, DungeonWall> baseWallsByEdge = new HashMap<>();
    private final Map<String, List<DungeonFeatureTile>> featureTilesByCoord = new HashMap<>();
    private final Map<Long, List<DungeonFeatureTile>> featureTilesByFeatureId = new HashMap<>();
    private final List<DungeonMapConnectionPath> roomConnections = new java.util.ArrayList<>();

    private DungeonMapState state;
    private Long loadedMapId;
    private Integer loadedMapWidth;
    private Integer loadedMapHeight;

    boolean loadState(DungeonMapState nextState) {
        Long previousMapId = loadedMapId;
        Integer previousWidth = loadedMapWidth;
        Integer previousHeight = loadedMapHeight;

        state = nextState;
        squaresByCoord.clear();
        roomsById.clear();
        featuresById.clear();
        connectionsById.clear();
        baseWallsByEdge.clear();
        featureTilesByCoord.clear();
        featureTilesByFeatureId.clear();
        roomConnections.clear();

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
        for (DungeonConnection connection : nextState.connections()) {
            if (connection.connectionId() != null) {
                connectionsById.put(connection.connectionId(), connection);
            }
        }
        for (DungeonFeature feature : nextState.features()) {
            featuresById.put(feature.featureId(), feature);
        }
        for (DungeonWall wall : nextState.walls()) {
            baseWallsByEdge.put(wall.edgeKey(), wall);
        }
        for (DungeonFeatureTile tile : nextState.featureTiles()) {
            featureTilesByCoord.computeIfAbsent(key(tile.x(), tile.y()), ignored -> new java.util.ArrayList<>()).add(tile);
            featureTilesByFeatureId.computeIfAbsent(tile.featureId(), ignored -> new java.util.ArrayList<>()).add(tile);
        }
        roomConnections.addAll(nextState.roomConnections());

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

    DungeonMapState state() {
        return state;
    }

    Map<String, DungeonSquare> squaresByCoord() {
        return squaresByCoord;
    }

    DungeonSquare squareAt(int x, int y) {
        return squaresByCoord.get(key(x, y));
    }

    Map<Long, DungeonRoom> roomsById() {
        return roomsById;
    }

    Map<Long, DungeonFeature> featuresById() {
        return featuresById;
    }

    Map<Long, DungeonConnection> connectionsById() {
        return connectionsById;
    }

    Map<String, DungeonWall> baseWallsByEdge() {
        return baseWallsByEdge;
    }

    Map<String, List<DungeonFeatureTile>> featureTilesByCoord() {
        return featureTilesByCoord;
    }

    Map<Long, List<DungeonFeatureTile>> featureTilesByFeatureId() {
        return featureTilesByFeatureId;
    }

    List<DungeonMapConnectionPath> roomConnections() {
        return roomConnections;
    }

    String resolveRoomName(Long roomId) {
        DungeonRoom room = roomId == null ? null : roomsById.get(roomId);
        return room == null ? null : room.name();
    }

    private static String key(int x, int y) {
        return x + ":" + y;
    }
}
