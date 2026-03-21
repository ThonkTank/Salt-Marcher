package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.state.EditorLayoutPreviewState;
import features.world.dungeonmap.state.EditorSelectionState;
import features.world.dungeonmap.state.DungeonMapState;

import java.util.Objects;

public final class ClusterSelectionDragController {

    private final DungeonMapState mapState;
    private final EditorSelectionState selectionState;
    private final EditorLayoutPreviewState layoutPreviewState;
    private final DungeonEditorHitTester hitTester = new DungeonGridHitTester();

    private ClusterDragSession dragSession;

    public ClusterSelectionDragController(
            DungeonMapState mapState,
            EditorSelectionState selectionState,
            EditorLayoutPreviewState layoutPreviewState
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.selectionState = Objects.requireNonNull(selectionState, "selectionState");
        this.layoutPreviewState = Objects.requireNonNull(layoutPreviewState, "layoutPreviewState");
    }

    public boolean handlePressed(DungeonCanvasPointerEvent event) {
        if (event == null || !event.isPrimaryButton()) {
            clear();
            return false;
        }
        DungeonEditorHitTarget hit = hitTester.hitTest(
                mapState.activeMap(),
                event.canvasPoint(),
                event.camera());
        clear();
        Long clusterId = clusterIdFor(hit);
        if (clusterId == null) {
            selectionState.clearSelection();
            return false;
        }
        selectionState.selectTarget(hit.targetKey());
        dragSession = new ClusterDragSession(clusterId, hit.targetKey(), mapState.activeMap(), event.gridCell());
        return true;
    }

    public boolean handleDragged(DungeonCanvasPointerEvent event) {
        if (dragSession == null || event == null || !event.isPrimaryButtonDown()) {
            return false;
        }
        Point2i delta = event.gridCell().subtract(dragSession.pressCell());
        if (Objects.equals(delta, dragSession.currentDelta())) {
            return true;
        }
        dragSession = dragSession.withCurrentDelta(delta);
        layoutPreviewState.showPreview(dragSession.baseMap().withTranslatedCluster(dragSession.clusterId(), delta));
        return true;
    }

    public boolean handleReleased(DungeonCanvasPointerEvent event) {
        if (dragSession == null || event == null) {
            return false;
        }
        Point2i delta = event.gridCell().subtract(dragSession.pressCell());
        DungeonLayout committed = dragSession.baseMap().withTranslatedCluster(dragSession.clusterId(), delta);
        selectionState.selectTarget(dragSession.targetKey());
        layoutPreviewState.clearPreview();
        dragSession = null;
        if (committed != null && committed != mapState.activeMap()) {
            mapState.showEditedMap(committed);
        }
        return true;
    }

    public void clear() {
        dragSession = null;
        layoutPreviewState.clearPreview();
    }

    private static Long clusterIdFor(DungeonEditorHitTarget target) {
        if (target == null) {
            return null;
        }
        return switch (target.targetRef()) {
            case DungeonEditorTargetRef.ClusterRef clusterRef -> clusterRef.clusterId();
        };
    }

    private record ClusterDragSession(
            Long clusterId,
            String targetKey,
            DungeonLayout baseMap,
            Point2i pressCell,
            Point2i currentDelta
    ) {
        private ClusterDragSession(Long clusterId, String targetKey, DungeonLayout baseMap, Point2i pressCell) {
            this(clusterId, targetKey, baseMap, pressCell, new Point2i(0, 0));
        }

        private ClusterDragSession withCurrentDelta(Point2i delta) {
            return new ClusterDragSession(clusterId, targetKey, baseMap, pressCell, delta);
        }
    }
}
