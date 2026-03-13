package features.world.dungeonmap.ui.canvas;

import features.world.dungeonmap.model.DungeonEdgeIndex;
import features.world.dungeonmap.model.DungeonEdgeSummary;
import features.world.dungeonmap.model.DungeonEdgeSummaryBuilder;
import features.world.dungeonmap.model.DungeonMapState;
import features.world.dungeonmap.model.DungeonPassage;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.model.DungeonWall;
import features.world.dungeonmap.model.DungeonWallEdit;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

final class DungeonCanvasPreviewTopology {

    private final Map<String, DungeonWallEdit> committedWallPreviewEdits = new HashMap<>();
    private final Map<String, DungeonWallEdit> activeWallPathPreviewEdits = new HashMap<>();
    private DungeonEdgeIndex edgeIndex = DungeonEdgeIndex.empty();

    void resetForLoadedState(DungeonMapState state) {
        committedWallPreviewEdits.clear();
        activeWallPathPreviewEdits.clear();
        edgeIndex = state == null || state.edgeIndex() == null ? DungeonEdgeIndex.empty() : state.edgeIndex();
    }

    void previewCommittedWallEdits(
            DungeonMapState state,
            Map<String, DungeonSquare> squaresByCoord,
            Map<String, DungeonWall> baseWallsByEdge,
            Map<String, DungeonPassage> basePassagesByEdge,
            List<DungeonWallEdit> edits
    ) {
        committedWallPreviewEdits.clear();
        storeWallPreviewEdits(state, committedWallPreviewEdits, edits);
        rebuildEdgeTopology(state, squaresByCoord, baseWallsByEdge, basePassagesByEdge);
    }

    void previewActiveWallPath(
            DungeonMapState state,
            Map<String, DungeonSquare> squaresByCoord,
            Map<String, DungeonWall> baseWallsByEdge,
            Map<String, DungeonPassage> basePassagesByEdge,
            List<DungeonWallEdit> edits
    ) {
        activeWallPathPreviewEdits.clear();
        storeWallPreviewEdits(state, activeWallPathPreviewEdits, edits);
        rebuildEdgeTopology(state, squaresByCoord, baseWallsByEdge, basePassagesByEdge);
    }

    boolean clearActiveWallPathPreview(
            DungeonMapState state,
            Map<String, DungeonSquare> squaresByCoord,
            Map<String, DungeonWall> baseWallsByEdge,
            Map<String, DungeonPassage> basePassagesByEdge
    ) {
        if (activeWallPathPreviewEdits.isEmpty()) {
            return false;
        }
        activeWallPathPreviewEdits.clear();
        rebuildEdgeTopology(state, squaresByCoord, baseWallsByEdge, basePassagesByEdge);
        return true;
    }

    void rebuildAfterSquarePreview(
            DungeonMapState state,
            Map<String, DungeonSquare> squaresByCoord,
            Map<String, DungeonWall> baseWallsByEdge,
            Map<String, DungeonPassage> basePassagesByEdge
    ) {
        rebuildEdgeTopology(state, squaresByCoord, baseWallsByEdge, basePassagesByEdge);
    }

    DungeonEdgeSummary edgeAt(String edgeKey) {
        return edgeIndex.edgeAt(edgeKey);
    }

    private void storeWallPreviewEdits(DungeonMapState state, Map<String, DungeonWallEdit> target, List<DungeonWallEdit> edits) {
        if (state == null || state.map() == null || edits == null) {
            return;
        }
        for (DungeonWallEdit edit : edits) {
            if (edit != null) {
                target.put(edit.edgeKey(), edit);
            }
        }
    }

    private void rebuildEdgeTopology(
            DungeonMapState state,
            Map<String, DungeonSquare> squaresByCoord,
            Map<String, DungeonWall> baseWallsByEdge,
            Map<String, DungeonPassage> basePassagesByEdge
    ) {
        Map<String, DungeonWall> previewWallsByEdge = new HashMap<>(baseWallsByEdge);
        Map<String, DungeonPassage> previewPassagesByEdge = new HashMap<>(basePassagesByEdge);
        applyWallPreviewEdits(state, previewWallsByEdge, previewPassagesByEdge, committedWallPreviewEdits);
        applyWallPreviewEdits(state, previewWallsByEdge, previewPassagesByEdge, activeWallPathPreviewEdits);
        edgeIndex = DungeonEdgeSummaryBuilder.buildPreviewIndex(
                new ArrayList<>(squaresByCoord.values()),
                new ArrayList<>(previewWallsByEdge.values()),
                new ArrayList<>(previewPassagesByEdge.values()));
    }

    private void applyWallPreviewEdits(
            DungeonMapState state,
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
}
