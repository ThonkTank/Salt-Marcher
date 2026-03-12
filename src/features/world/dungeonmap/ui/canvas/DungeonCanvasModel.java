package features.world.dungeonmap.ui.canvas;

import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonFeature;
import features.world.dungeonmap.model.DungeonFeatureTile;
import features.world.dungeonmap.model.DungeonLink;
import features.world.dungeonmap.model.DungeonMapState;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonSelection;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.model.DungeonSquarePaint;
import features.world.dungeonmap.model.DungeonWallEdit;
import features.world.dungeonmap.model.DungeonWall;
import features.world.dungeonmap.model.PassageDirection;

import java.util.HashMap;
import java.util.Map;

final class DungeonCanvasModel {

    private final Map<String, DungeonSquare> squaresByCoord = new HashMap<>();
    private final Map<Long, DungeonFeature> featuresById = new HashMap<>();
    private final Map<Long, DungeonEndpoint> endpointsById = new HashMap<>();
    private final Map<Long, DungeonLink> linksById = new HashMap<>();
    private final Map<String, DungeonWall> baseWallsByEdge = new HashMap<>();
    private final Map<String, DungeonPassage> basePassagesByEdge = new HashMap<>();
    private final Map<String, DungeonWall> wallsByEdge = new HashMap<>();
    private final Map<String, DungeonPassage> passagesByEdge = new HashMap<>();
    private final Map<String, DungeonWallEdit> committedWallPreviewEdits = new HashMap<>();
    private final Map<String, DungeonWallEdit> activeWallPathPreviewEdits = new HashMap<>();
    private final Map<String, java.util.List<DungeonFeatureTile>> featureTilesByCoord = new HashMap<>();
    private final Map<Long, java.util.List<DungeonFeatureTile>> featureTilesByFeatureId = new HashMap<>();

    private DungeonMapState state;
    private DungeonSelection selection = DungeonSelection.none();
    private Long pendingLinkStartId;
    private Long partyEndpointId;
    private String invalidEdgeKey;
    private Integer invalidEdgeX;
    private Integer invalidEdgeY;
    private PassageDirection invalidEdgeDirection;
    private Long loadedMapId;
    private Integer loadedMapWidth;
    private Integer loadedMapHeight;

    boolean loadState(DungeonMapState state) {
        Long previousMapId = loadedMapId;
        Integer previousWidth = loadedMapWidth;
        Integer previousHeight = loadedMapHeight;

        this.state = state;
        squaresByCoord.clear();
        featuresById.clear();
        endpointsById.clear();
        linksById.clear();
        baseWallsByEdge.clear();
        basePassagesByEdge.clear();
        wallsByEdge.clear();
        passagesByEdge.clear();
        committedWallPreviewEdits.clear();
        activeWallPathPreviewEdits.clear();
        featureTilesByCoord.clear();
        featureTilesByFeatureId.clear();

        if (state == null || state.map() == null) {
            loadedMapId = null;
            loadedMapWidth = null;
            loadedMapHeight = null;
            selection = DungeonSelection.none();
            pendingLinkStartId = null;
            partyEndpointId = null;
            clearInvalidEdge();
            return true;
        }

        for (DungeonSquare square : state.squares()) {
            squaresByCoord.put(key(square.x(), square.y()), square);
        }
        for (DungeonEndpoint endpoint : state.endpoints()) {
            endpointsById.put(endpoint.endpointId(), endpoint);
        }
        for (DungeonFeature feature : state.features()) {
            featuresById.put(feature.featureId(), feature);
        }
        for (DungeonLink link : state.links()) {
            linksById.put(link.linkId(), link);
        }
        for (DungeonWall wall : state.walls()) {
            baseWallsByEdge.put(wall.edgeKey(), wall);
        }
        for (DungeonPassage passage : state.passages()) {
            basePassagesByEdge.put(passage.edgeKey(), passage);
        }
        for (DungeonFeatureTile tile : state.featureTiles()) {
            featureTilesByCoord.computeIfAbsent(key(tile.x(), tile.y()), ignored -> new java.util.ArrayList<>()).add(tile);
            featureTilesByFeatureId.computeIfAbsent(tile.featureId(), ignored -> new java.util.ArrayList<>()).add(tile);
        }

        selection = DungeonSelection.none();
        partyEndpointId = null;
        pendingLinkStartId = null;
        clearInvalidEdge();
        loadedMapId = state.map().mapId();
        loadedMapWidth = state.map().width();
        loadedMapHeight = state.map().height();
        rebuildEdgeTopology();

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

    void previewCommittedWallEdits(java.util.List<DungeonWallEdit> edits) {
        committedWallPreviewEdits.clear();
        storeWallPreviewEdits(committedWallPreviewEdits, edits);
        rebuildEdgeTopology();
    }

    void previewActiveWallPath(java.util.List<DungeonWallEdit> edits) {
        activeWallPathPreviewEdits.clear();
        storeWallPreviewEdits(activeWallPathPreviewEdits, edits);
        rebuildEdgeTopology();
    }

    void clearActiveWallPathPreview() {
        if (activeWallPathPreviewEdits.isEmpty()) {
            return;
        }
        activeWallPathPreviewEdits.clear();
        rebuildEdgeTopology();
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

    DungeonSquare squareAt(int x, int y) {
        return squaresByCoord.get(key(x, y));
    }

    Map<Long, DungeonEndpoint> endpointsById() {
        return endpointsById;
    }

    Map<Long, DungeonFeature> featuresById() {
        return featuresById;
    }

    Map<Long, DungeonLink> linksById() {
        return linksById;
    }

    Map<String, DungeonPassage> passagesByEdge() {
        return passagesByEdge;
    }

    Map<String, DungeonWall> wallsByEdge() {
        return wallsByEdge;
    }

    Map<String, java.util.List<DungeonFeatureTile>> featureTilesByCoord() {
        return featureTilesByCoord;
    }

    Map<Long, java.util.List<DungeonFeatureTile>> featureTilesByFeatureId() {
        return featureTilesByFeatureId;
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

    private void storeWallPreviewEdits(Map<String, DungeonWallEdit> target, java.util.List<DungeonWallEdit> edits) {
        if (state == null || state.map() == null || edits == null) {
            return;
        }
        for (DungeonWallEdit edit : edits) {
            if (edit != null) {
                target.put(edit.edgeKey(), edit);
            }
        }
    }

    private void rebuildEdgeTopology() {
        wallsByEdge.clear();
        passagesByEdge.clear();
        wallsByEdge.putAll(baseWallsByEdge);
        passagesByEdge.putAll(basePassagesByEdge);
        applyWallPreviewEdits(committedWallPreviewEdits);
        applyWallPreviewEdits(activeWallPathPreviewEdits);
    }

    private void applyWallPreviewEdits(Map<String, DungeonWallEdit> edits) {
        if (state == null || state.map() == null) {
            return;
        }
        for (DungeonWallEdit edit : edits.values()) {
            String edgeKey = edit.edgeKey();
            if (edit.wallPresent()) {
                wallsByEdge.put(edgeKey, new DungeonWall(null, state.map().mapId(), edit.x(), edit.y(), edit.direction()));
                passagesByEdge.remove(edgeKey);
            } else {
                wallsByEdge.remove(edgeKey);
            }
        }
    }

    Long partyEndpointId() {
        return partyEndpointId;
    }

    void setPartyEndpointId(Long partyEndpointId) {
        this.partyEndpointId = partyEndpointId;
    }

    void setInvalidEdge(int x, int y, PassageDirection direction) {
        if (direction == null) {
            clearInvalidEdge();
            return;
        }
        invalidEdgeX = x;
        invalidEdgeY = y;
        invalidEdgeDirection = direction;
        invalidEdgeKey = direction.edgeKey(x, y);
    }

    void clearInvalidEdge() {
        invalidEdgeX = null;
        invalidEdgeY = null;
        invalidEdgeDirection = null;
        invalidEdgeKey = null;
    }

    String invalidEdgeKey() {
        return invalidEdgeKey;
    }

    Integer invalidEdgeX() {
        return invalidEdgeX;
    }

    Integer invalidEdgeY() {
        return invalidEdgeY;
    }

    PassageDirection invalidEdgeDirection() {
        return invalidEdgeDirection;
    }

    private static String key(int x, int y) {
        return x + ":" + y;
    }
}
