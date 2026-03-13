package features.world.dungeonmap.ui.runtime;

import features.world.dungeonmap.model.domain.DungeonArea;
import features.world.dungeonmap.model.domain.DungeonEndpoint;
import features.world.dungeonmap.model.domain.DungeonRoom;
import features.world.dungeonmap.model.domain.DungeonSquare;
import features.world.dungeonmap.model.projection.DungeonMapState;
import features.world.dungeonmap.model.projection.DungeonRuntimeState;

import java.util.HashMap;
import java.util.Map;

public final class DungeonRuntimeViewState {

    private DungeonMapState currentState;
    private Long activeEndpointId;
    private Long activeSquareId;
    private boolean requiresInitialPosition;
    private final Map<Long, DungeonEndpoint> endpointsById = new HashMap<>();
    private final Map<Long, DungeonSquare> squaresById = new HashMap<>();
    private final Map<Long, DungeonArea> areasById = new HashMap<>();
    private long loadRequestToken;
    private Long selectedMapId;
    private String runtimeStatusMessage;

    public long beginLoad(Long mapId) {
        if (mapId != null) {
            selectedMapId = mapId;
        }
        return ++loadRequestToken;
    }

    public boolean isCurrentLoad(long requestToken) {
        return requestToken == loadRequestToken;
    }

    public void applyRuntimeState(DungeonRuntimeState runtimeState) {
        currentState = runtimeState == null ? null : runtimeState.mapState();
        activeEndpointId = runtimeState == null ? null : runtimeState.activeEndpointId();
        activeSquareId = runtimeState == null ? null : runtimeState.activeSquareId();
        requiresInitialPosition = runtimeState != null && runtimeState.requiresInitialPosition();
        selectedMapId = currentState == null || currentState.map() == null ? null : currentState.map().mapId();
        rebuildLookups();
    }

    public void applyLoadFailure(Long mapId) {
        currentState = null;
        activeEndpointId = null;
        activeSquareId = null;
        requiresInitialPosition = false;
        endpointsById.clear();
        squaresById.clear();
        areasById.clear();
        if (mapId != null) {
            selectedMapId = mapId;
        }
    }

    public DungeonMapState currentState() {
        return currentState;
    }

    public Long activeEndpointId() {
        return activeEndpointId;
    }

    public Long activeSquareId() {
        return activeSquareId;
    }

    public boolean requiresInitialPosition() {
        return requiresInitialPosition;
    }

    public Long selectedMapId() {
        return selectedMapId;
    }

    public void setRuntimeStatusMessage(String runtimeStatusMessage) {
        this.runtimeStatusMessage = runtimeStatusMessage;
    }

    public String runtimeStatusMessage() {
        return runtimeStatusMessage;
    }

    public Long currentMapId() {
        return currentState == null || currentState.map() == null ? null : currentState.map().mapId();
    }

    public DungeonEndpoint endpointById(Long endpointId) {
        return endpointId == null ? null : endpointsById.get(endpointId);
    }

    public DungeonSquare squareById(Long squareId) {
        return squareId == null ? null : squaresById.get(squareId);
    }

    public DungeonArea areaById(Long areaId) {
        return areaId == null ? null : areasById.get(areaId);
    }

    public DungeonRoom activeRoom() {
        DungeonSquare square = squareById(activeSquareId);
        return square == null || currentState == null ? null : currentState.index().findRoom(square.roomId());
    }

    private void rebuildLookups() {
        endpointsById.clear();
        squaresById.clear();
        areasById.clear();
        if (currentState == null) {
            return;
        }
        for (DungeonEndpoint endpoint : currentState.endpoints()) {
            endpointsById.put(endpoint.endpointId(), endpoint);
        }
        for (DungeonSquare square : currentState.squares()) {
            if (square.squareId() != null) {
                squaresById.put(square.squareId(), square);
            }
        }
        for (DungeonArea area : currentState.areas()) {
            areasById.put(area.areaId(), area);
        }
    }
}
