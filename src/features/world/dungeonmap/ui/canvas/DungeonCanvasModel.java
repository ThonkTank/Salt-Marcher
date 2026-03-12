package features.world.dungeonmap.ui.canvas;

import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonEdgeIndex;
import features.world.dungeonmap.model.DungeonEdgeSummary;
import features.world.dungeonmap.model.DungeonEdgeSummaryBuilder;
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

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

final class DungeonCanvasModel {

    private final Map<String, DungeonSquare> squaresByCoord = new HashMap<>();
    private final Map<Long, DungeonRoom> roomsById = new HashMap<>();
    private final Map<Long, DungeonFeature> featuresById = new HashMap<>();
    private final Map<Long, DungeonEndpoint> endpointsById = new HashMap<>();
    private final Map<Long, DungeonLink> linksById = new HashMap<>();
    private final Map<String, DungeonWall> baseWallsByEdge = new HashMap<>();
    private final Map<String, DungeonPassage> basePassagesByEdge = new HashMap<>();
    private DungeonEdgeIndex edgeIndex = DungeonEdgeIndex.empty();
    private final Map<String, DungeonWallEdit> committedWallPreviewEdits = new HashMap<>();
    private final Map<String, DungeonWallEdit> activeWallPathPreviewEdits = new HashMap<>();
    private final Map<String, java.util.List<DungeonFeatureTile>> featureTilesByCoord = new HashMap<>();
    private final Map<Long, java.util.List<DungeonFeatureTile>> featureTilesByFeatureId = new HashMap<>();
    private final Map<Long, java.util.List<DungeonSquare>> squaresByRoomId = new HashMap<>();
    private final Map<Long, RoomLabelAnchor> roomLabelAnchors = new HashMap<>();

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
        roomsById.clear();
        featuresById.clear();
        endpointsById.clear();
        linksById.clear();
        baseWallsByEdge.clear();
        basePassagesByEdge.clear();
        edgeIndex = DungeonEdgeIndex.empty();
        committedWallPreviewEdits.clear();
        activeWallPathPreviewEdits.clear();
        featureTilesByCoord.clear();
        featureTilesByFeatureId.clear();
        squaresByRoomId.clear();
        roomLabelAnchors.clear();

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
        for (DungeonRoom room : state.rooms()) {
            roomsById.put(room.roomId(), room);
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
        loadBaseTopology(state);
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
        rebuildRoomSquareIndex();
        edgeIndex = state.edgeIndex() == null ? DungeonEdgeIndex.empty() : state.edgeIndex();

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
            Long roomId = existing == null ? null : existing.roomId();
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
        rebuildRoomSquareIndex();
        rebuildEdgeTopology();
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

    Map<Long, DungeonRoom> roomsById() {
        return roomsById;
    }

    Map<Long, DungeonFeature> featuresById() {
        return featuresById;
    }

    Map<Long, DungeonLink> linksById() {
        return linksById;
    }

    DungeonEdgeSummary edgeAt(String edgeKey) {
        return edgeIndex.edgeAt(edgeKey);
    }

    Map<String, java.util.List<DungeonFeatureTile>> featureTilesByCoord() {
        return featureTilesByCoord;
    }

    Map<Long, java.util.List<DungeonFeatureTile>> featureTilesByFeatureId() {
        return featureTilesByFeatureId;
    }

    Map<Long, java.util.List<DungeonSquare>> squaresByRoomId() {
        return squaresByRoomId;
    }

    Map<Long, RoomLabelAnchor> roomLabelAnchors() {
        return roomLabelAnchors;
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
        Map<String, DungeonWall> previewWallsByEdge = new HashMap<>(baseWallsByEdge);
        Map<String, DungeonPassage> previewPassagesByEdge = new HashMap<>(basePassagesByEdge);
        applyWallPreviewEdits(previewWallsByEdge, previewPassagesByEdge, committedWallPreviewEdits);
        applyWallPreviewEdits(previewWallsByEdge, previewPassagesByEdge, activeWallPathPreviewEdits);
        // The shared edge builder owns preview synthesis of topology boundary walls so the
        // canvas stays a consumer of the derived edge model instead of reimplementing it.
        edgeIndex = DungeonEdgeSummaryBuilder.buildPreviewIndex(
                new ArrayList<>(squaresByCoord.values()),
                new ArrayList<>(previewWallsByEdge.values()),
                new ArrayList<>(previewPassagesByEdge.values()));
    }

    private void loadBaseTopology(DungeonMapState state) {
        baseWallsByEdge.clear();
        basePassagesByEdge.clear();
        if (state == null) {
            return;
        }
        for (DungeonWall wall : state.walls()) {
            baseWallsByEdge.put(wall.edgeKey(), wall);
        }
        for (DungeonPassage passage : state.passages()) {
            basePassagesByEdge.put(passage.edgeKey(), passage);
        }
    }

    private void rebuildRoomSquareIndex() {
        squaresByRoomId.clear();
        roomLabelAnchors.clear();
        for (DungeonSquare square : squaresByCoord.values()) {
            if (square.roomId() != null) {
                squaresByRoomId.computeIfAbsent(square.roomId(), ignored -> new java.util.ArrayList<>()).add(square);
            }
        }
        for (Map.Entry<Long, java.util.List<DungeonSquare>> entry : squaresByRoomId.entrySet()) {
            RoomLabelAnchor anchor = selectRoomLabelAnchor(entry.getValue());
            if (anchor != null) {
                roomLabelAnchors.put(entry.getKey(), anchor);
            }
        }
    }

    private RoomLabelAnchor selectRoomLabelAnchor(java.util.List<DungeonSquare> squares) {
        if (squares == null || squares.isEmpty()) {
            return null;
        }
        Set<String> roomCoords = new HashSet<>();
        double centerX = 0.0;
        double centerY = 0.0;
        for (DungeonSquare square : squares) {
            roomCoords.add(key(square.x(), square.y()));
            centerX += square.x() + 0.5;
            centerY += square.y() + 0.5;
        }
        centerX /= squares.size();
        centerY /= squares.size();

        DungeonSquare bestSquare = null;
        int bestNeighborCount = -1;
        double bestDistance = Double.MAX_VALUE;
        for (DungeonSquare square : squares) {
            int neighborCount = roomNeighborCount(square, roomCoords);
            double dx = (square.x() + 0.5) - centerX;
            double dy = (square.y() + 0.5) - centerY;
            double distance = (dx * dx) + (dy * dy);
            if (bestSquare == null
                    || neighborCount > bestNeighborCount
                    || neighborCount == bestNeighborCount && distance < bestDistance
                    || neighborCount == bestNeighborCount && distance == bestDistance && square.y() < bestSquare.y()
                    || neighborCount == bestNeighborCount && distance == bestDistance && square.y() == bestSquare.y() && square.x() < bestSquare.x()) {
                bestSquare = square;
                bestNeighborCount = neighborCount;
                bestDistance = distance;
            }
        }
        return new RoomLabelAnchor(bestSquare.x(), bestSquare.y(), squares.size());
    }

    private int roomNeighborCount(DungeonSquare square, Set<String> roomCoords) {
        int neighbors = 0;
        if (roomCoords.contains(key(square.x() - 1, square.y()))) neighbors++;
        if (roomCoords.contains(key(square.x() + 1, square.y()))) neighbors++;
        if (roomCoords.contains(key(square.x(), square.y() - 1))) neighbors++;
        if (roomCoords.contains(key(square.x(), square.y() + 1))) neighbors++;
        return neighbors;
    }

    private void applyWallPreviewEdits(
            Map<String, DungeonWall> previewWallsByEdge,
            Map<String, DungeonPassage> previewPassagesByEdge,
            Map<String, DungeonWallEdit> edits
    ) {
        if (state == null || state.map() == null) {
            return;
        }
        for (DungeonWallEdit edit : edits.values()) {
            String edgeKey = edit.edgeKey();
            if (edit.wallPresent()) {
                previewWallsByEdge.put(edgeKey, new DungeonWall(null, state.map().mapId(), edit.x(), edit.y(), edit.direction()));
                previewPassagesByEdge.remove(edgeKey);
            } else {
                previewWallsByEdge.remove(edgeKey);
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

    record RoomLabelAnchor(int x, int y, int squareCount) {
    }
}
