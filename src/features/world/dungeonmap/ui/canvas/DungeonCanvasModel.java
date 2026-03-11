package features.world.dungeonmap.ui.canvas;

import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonLink;
import features.world.dungeonmap.model.DungeonMapState;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonSelection;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.model.DungeonSquarePaint;

import java.util.HashMap;
import java.util.Map;

final class DungeonCanvasModel {

    private final Map<String, DungeonSquare> squaresByCoord = new HashMap<>();
    private final Map<Long, DungeonEndpoint> endpointsById = new HashMap<>();
    private final Map<Long, DungeonLink> linksById = new HashMap<>();

    private DungeonMapState state;
    private DungeonSelection selection = DungeonSelection.none();
    private Long pendingLinkStartId;
    private Long partyEndpointId;
    private Long loadedMapId;
    private Integer loadedMapWidth;
    private Integer loadedMapHeight;

    boolean loadState(DungeonMapState state) {
        Long previousMapId = loadedMapId;
        Integer previousWidth = loadedMapWidth;
        Integer previousHeight = loadedMapHeight;

        this.state = state;
        squaresByCoord.clear();
        endpointsById.clear();
        linksById.clear();

        if (state == null || state.map() == null) {
            loadedMapId = null;
            loadedMapWidth = null;
            loadedMapHeight = null;
            selection = DungeonSelection.none();
            pendingLinkStartId = null;
            partyEndpointId = null;
            return true;
        }

        for (DungeonSquare square : state.squares()) {
            squaresByCoord.put(key(square.x(), square.y()), square);
        }
        for (DungeonEndpoint endpoint : state.endpoints()) {
            endpointsById.put(endpoint.endpointId(), endpoint);
        }
        for (DungeonLink link : state.links()) {
            linksById.put(link.linkId(), link);
        }

        selection = DungeonSelection.none();
        partyEndpointId = null;
        pendingLinkStartId = null;
        loadedMapId = state.map().mapId();
        loadedMapWidth = state.map().width();
        loadedMapHeight = state.map().height();

        return previousMapId == null
                || !previousMapId.equals(loadedMapId)
                || previousWidth == null
                || previousHeight == null
                || !previousWidth.equals(loadedMapWidth)
                || !previousHeight.equals(loadedMapHeight);
    }

    void previewPaint(DungeonSquarePaint paint) {
        if (state == null || state.map() == null) {
            return;
        }
        String key = key(paint.x(), paint.y());
        if (paint.filled()) {
            DungeonSquare existing = squaresByCoord.get(key);
            Long roomId = paint.roomId() != null ? paint.roomId() : (existing == null ? null : existing.roomId());
            String roomName = resolveRoomName(roomId);
            Long areaId = existing == null ? null : existing.areaId();
            String areaName = existing == null ? null : existing.areaName();
            squaresByCoord.put(key, new DungeonSquare(
                    existing == null ? null : existing.squareId(),
                    state.map().mapId(),
                    paint.x(),
                    paint.y(),
                    roomId,
                    roomName,
                    areaId,
                    areaName));
        } else {
            squaresByCoord.remove(key);
        }
    }

    private String resolveRoomName(Long roomId) {
        if (roomId == null || state == null) {
            return null;
        }
        for (DungeonRoom room : state.rooms()) {
            if (roomId.equals(room.roomId())) {
                return room.name();
            }
        }
        return null;
    }

    DungeonMapPane.CellInteraction interactionAt(DungeonViewport viewport, double screenX, double screenY) {
        if (state == null || state.map() == null) {
            return null;
        }
        int cellX = viewport.cellX(screenX);
        int cellY = viewport.cellY(screenY);
        if (cellX < 0 || cellY < 0 || cellX >= state.map().width() || cellY >= state.map().height()) {
            return null;
        }
        return new DungeonMapPane.CellInteraction(cellX, cellY, squaresByCoord.get(key(cellX, cellY)));
    }

    DungeonMapState state() {
        return state;
    }

    Map<String, DungeonSquare> squaresByCoord() {
        return squaresByCoord;
    }

    Map<Long, DungeonEndpoint> endpointsById() {
        return endpointsById;
    }

    Map<Long, DungeonLink> linksById() {
        return linksById;
    }

    DungeonSelection selection() {
        return selection;
    }

    void setSelection(DungeonSelection selection) {
        this.selection = selection == null ? DungeonSelection.none() : selection;
    }

    Long pendingLinkStartId() {
        return pendingLinkStartId;
    }

    void setPendingLinkStartId(Long pendingLinkStartId) {
        this.pendingLinkStartId = pendingLinkStartId;
    }

    Long partyEndpointId() {
        return partyEndpointId;
    }

    void setPartyEndpointId(Long partyEndpointId) {
        this.partyEndpointId = partyEndpointId;
    }

    private static String key(int x, int y) {
        return x + ":" + y;
    }
}
