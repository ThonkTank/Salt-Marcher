package features.world.dungeonmap.ui.shared.canvas;

import features.world.dungeonmap.model.projection.edge.DungeonEdgeIndex;
import features.world.dungeonmap.model.projection.edge.DungeonEdgeSummary;
import features.world.dungeonmap.service.projection.DungeonEdgeSummaryBuilder;
import features.world.dungeonmap.model.projection.DungeonMapState;
import features.world.dungeonmap.model.domain.DungeonSquare;
import features.world.dungeonmap.model.domain.DungeonWall;
import features.world.dungeonmap.model.editing.DungeonWallEdit;

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
            List<DungeonWallEdit> edits
    ) {
        committedWallPreviewEdits.clear();
        storeWallPreviewEdits(state, committedWallPreviewEdits, edits);
        rebuildEdgeTopology(state, squaresByCoord, baseWallsByEdge);
    }

    void previewActiveWallPath(
            DungeonMapState state,
            Map<String, DungeonSquare> squaresByCoord,
            Map<String, DungeonWall> baseWallsByEdge,
            List<DungeonWallEdit> edits
    ) {
        activeWallPathPreviewEdits.clear();
        storeWallPreviewEdits(state, activeWallPathPreviewEdits, edits);
        rebuildEdgeTopology(state, squaresByCoord, baseWallsByEdge);
    }

    boolean clearActiveWallPathPreview(
            DungeonMapState state,
            Map<String, DungeonSquare> squaresByCoord,
            Map<String, DungeonWall> baseWallsByEdge
    ) {
        if (activeWallPathPreviewEdits.isEmpty()) {
            return false;
        }
        activeWallPathPreviewEdits.clear();
        rebuildEdgeTopology(state, squaresByCoord, baseWallsByEdge);
        return true;
    }

    void rebuildAfterSquarePreview(
            DungeonMapState state,
            Map<String, DungeonSquare> squaresByCoord,
            Map<String, DungeonWall> baseWallsByEdge
    ) {
        rebuildEdgeTopology(state, squaresByCoord, baseWallsByEdge);
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
            Map<String, DungeonWall> baseWallsByEdge
    ) {
        Map<String, DungeonWall> previewWallsByEdge = new HashMap<>(baseWallsByEdge);
        applyWallPreviewEdits(state, previewWallsByEdge, committedWallPreviewEdits);
        applyWallPreviewEdits(state, previewWallsByEdge, activeWallPathPreviewEdits);
        edgeIndex = DungeonEdgeSummaryBuilder.buildPreviewIndex(
                new ArrayList<>(squaresByCoord.values()),
                new ArrayList<>(previewWallsByEdge.values()));
    }

    private void applyWallPreviewEdits(
            DungeonMapState state,
            Map<String, DungeonWall> previewWallsByEdge,
            Map<String, DungeonWallEdit> edits
    ) {
        if (state == null || state.map() == null) {
            return;
        }
        for (DungeonWallEdit edit : edits.values()) {
            String edgeKey = edit.edgeKey();
            if (edit.wallPresent()) {
                previewWallsByEdge.put(edgeKey, new DungeonWall(null, state.map().mapId(), edit.x(), edit.y(), edit.direction()));
            } else {
                previewWallsByEdge.remove(edgeKey);
            }
        }
    }
}
