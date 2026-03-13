package features.world.dungeonmap.ui.canvas;

import features.world.dungeonmap.model.DungeonEdgeSummary;
import features.world.dungeonmap.model.DungeonEndpoint;
import features.world.dungeonmap.model.DungeonFeature;
import features.world.dungeonmap.model.DungeonFeatureTile;
import features.world.dungeonmap.model.DungeonLink;
import features.world.dungeonmap.model.DungeonLinkAnchor;
import features.world.dungeonmap.model.DungeonMapState;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.DungeonSelection;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.model.DungeonSquarePaint;
import features.world.dungeonmap.model.DungeonWallEdit;
import features.world.dungeonmap.model.PassageDirection;
import features.world.dungeonmap.ui.canvas.model.DungeonCanvasInteractionState;
import features.world.dungeonmap.ui.canvas.model.DungeonCanvasLabelLayout;
import features.world.dungeonmap.ui.canvas.model.DungeonCanvasLoadedState;
import features.world.dungeonmap.ui.canvas.model.DungeonCanvasPreviewTopology;

import java.util.List;
import java.util.Map;

final class DungeonCanvasModel {

    private final DungeonCanvasLoadedState loadedState = new DungeonCanvasLoadedState();
    private final DungeonCanvasPreviewTopology previewTopology = new DungeonCanvasPreviewTopology();
    private final DungeonCanvasLabelLayout labelLayout = new DungeonCanvasLabelLayout();
    private final DungeonCanvasInteractionState interactionState = new DungeonCanvasInteractionState();

    boolean loadState(DungeonMapState state) {
        boolean shouldFitViewport = loadedState.loadState(state);
        interactionState.resetForLoadedState();
        previewTopology.resetForLoadedState(state);
        labelLayout.rebuild(loadedState.squaresByCoord());
        return shouldFitViewport;
    }

    void previewPaint(DungeonSquarePaint paint) {
        if (state() == null || state().map() == null) {
            return;
        }
        String key = key(paint.x(), paint.y());
        if (paint.filled()) {
            DungeonSquare existing = loadedState.squaresByCoord().get(key);
            Long roomId = existing == null ? null : existing.roomId();
            String roomName = loadedState.resolveRoomName(roomId);
            Long areaId = existing == null ? null : existing.areaId();
            String areaName = existing == null ? null : existing.areaName();
            loadedState.squaresByCoord().put(key, new DungeonSquare(
                    existing == null ? null : existing.squareId(),
                    state().map().mapId(),
                    paint.x(),
                    paint.y(),
                    roomId,
                    roomName,
                    areaId,
                    areaName));
        } else {
            loadedState.squaresByCoord().remove(key);
        }
        labelLayout.rebuild(loadedState.squaresByCoord());
        previewTopology.rebuildAfterSquarePreview(
                state(),
                loadedState.squaresByCoord(),
                loadedState.baseWallsByEdge(),
                loadedState.basePassagesByEdge());
    }

    void previewCommittedWallEdits(List<DungeonWallEdit> edits) {
        previewTopology.previewCommittedWallEdits(
                state(),
                loadedState.squaresByCoord(),
                loadedState.baseWallsByEdge(),
                loadedState.basePassagesByEdge(),
                edits);
    }

    void previewActiveWallPath(List<DungeonWallEdit> edits) {
        previewTopology.previewActiveWallPath(
                state(),
                loadedState.squaresByCoord(),
                loadedState.baseWallsByEdge(),
                loadedState.basePassagesByEdge(),
                edits);
    }

    void clearActiveWallPathPreview() {
        previewTopology.clearActiveWallPathPreview(
                state(),
                loadedState.squaresByCoord(),
                loadedState.baseWallsByEdge(),
                loadedState.basePassagesByEdge());
    }

    DungeonMapPane.CellInteraction interactionAt(DungeonViewport viewport, double screenX, double screenY) {
        if (state() == null || state().map() == null) {
            return null;
        }
        int cellX = viewport.cellX(screenX);
        int cellY = viewport.cellY(screenY);
        if (cellX < 0 || cellY < 0 || cellX >= state().map().width() || cellY >= state().map().height()) {
            return null;
        }
        return new DungeonMapPane.CellInteraction(cellX, cellY, squareAt(cellX, cellY));
    }

    DungeonMapState state() {
        return loadedState.state();
    }

    Map<String, DungeonSquare> squaresByCoord() {
        return loadedState.squaresByCoord();
    }

    DungeonSquare squareAt(int x, int y) {
        return loadedState.squareAt(x, y);
    }

    Map<Long, DungeonEndpoint> endpointsById() {
        return loadedState.endpointsById();
    }

    Map<Long, DungeonRoom> roomsById() {
        return loadedState.roomsById();
    }

    Map<Long, DungeonFeature> featuresById() {
        return loadedState.featuresById();
    }

    Map<Long, DungeonLink> linksById() {
        return loadedState.linksById();
    }

    Map<Long, DungeonPassage> passagesById() {
        return loadedState.passagesById();
    }

    DungeonEdgeSummary edgeAt(String edgeKey) {
        return previewTopology.edgeAt(edgeKey);
    }

    Map<String, List<DungeonFeatureTile>> featureTilesByCoord() {
        return loadedState.featureTilesByCoord();
    }

    Map<Long, List<DungeonFeatureTile>> featureTilesByFeatureId() {
        return loadedState.featureTilesByFeatureId();
    }

    Map<Long, List<DungeonSquare>> squaresByRoomId() {
        return labelLayout.squaresByRoomId();
    }

    Map<Long, DungeonCanvasLabelLayout.RoomLabelAnchor> roomLabelAnchors() {
        return labelLayout.roomLabelAnchors();
    }

    List<DungeonCanvasLabelLayout.AreaLabelAnchor> areaLabelAnchors() {
        return labelLayout.areaLabelAnchors();
    }

    DungeonSelection selection() {
        return interactionState.selection();
    }

    void setSelection(DungeonSelection selection) {
        interactionState.setSelection(selection);
    }

    DungeonLinkAnchor pendingLinkStart() {
        return interactionState.pendingLinkStart();
    }

    void setPendingLinkStart(DungeonLinkAnchor pendingLinkStart) {
        interactionState.setPendingLinkStart(pendingLinkStart);
    }

    Long partyEndpointId() {
        return interactionState.partyEndpointId();
    }

    void setPartyEndpointId(Long partyEndpointId) {
        interactionState.setPartyEndpointId(partyEndpointId);
    }

    void setInvalidEdge(int x, int y, PassageDirection direction) {
        interactionState.setInvalidEdge(x, y, direction);
    }

    void clearInvalidEdge() {
        interactionState.clearInvalidEdge();
    }

    Integer invalidEdgeX() {
        return interactionState.invalidEdgeX();
    }

    Integer invalidEdgeY() {
        return interactionState.invalidEdgeY();
    }

    PassageDirection invalidEdgeDirection() {
        return interactionState.invalidEdgeDirection();
    }

    private static String key(int x, int y) {
        return x + ":" + y;
    }
}
