package features.world.dungeonmap.editor.workspace.ui.grid;

import features.world.dungeonmap.editor.workspace.ui.base.DungeonPaneContext;
import features.world.dungeonmap.editor.workspace.ui.corridor.DungeonPaneCorridorWorkspace;
import features.world.dungeonmap.editor.workspace.ui.preview.DungeonPanePreviewModel;
import features.world.dungeonmap.editor.workspace.ui.preview.DungeonPaneRenderState;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.foundation.geometry.Point2i;
import features.world.dungeonmap.canvas.rendering.CorridorRenderKeys;
import javafx.geometry.Point2D;
import javafx.scene.canvas.GraphicsContext;

import java.util.Set;

final class DungeonGridVisualSupport {

    private final DungeonGridCorridorRenderSupport corridorSupport;
    private final DungeonGridRegionRenderSupport regionSupport;

    DungeonGridVisualSupport(
            DungeonPaneContext context,
            DungeonPanePreviewModel previewModel,
            DungeonPaneCorridorWorkspace corridorWorkspace,
            DungeonPaneRenderState renderState
    ) {
        this.regionSupport = new DungeonGridRegionRenderSupport(context, previewModel);
        this.corridorSupport = new DungeonGridCorridorRenderSupport(context, previewModel, corridorWorkspace, renderState, regionSupport);
    }

    void drawCorridors(GraphicsContext gc, Set<CorridorRenderKeys.CorridorSegmentKey> openSegments, Set<Long> encodedOpenSegments) {
        corridorSupport.drawCorridors(gc, openSegments, encodedOpenSegments);
    }

    void drawDoors(GraphicsContext gc) {
        corridorSupport.drawDoors(gc);
    }

    void drawCorridorEditHandles(GraphicsContext gc) {
        corridorSupport.drawCorridorEditHandles(gc);
    }

    void drawClusterEdges(GraphicsContext gc) {
        regionSupport.drawClusterEdges(gc);
    }

    void drawClusterAndRoomAnchors(GraphicsContext gc, DungeonRoomCluster cluster) {
        regionSupport.drawClusterAndRoomAnchors(gc, cluster);
    }

    void drawRoom(
            GraphicsContext gc,
            Set<Point2i> cells,
            Point2D previewOffset,
            boolean active,
            boolean selected,
            Set<CorridorRenderKeys.CorridorSegmentKey> openSegments,
            Set<Long> encodedOpenSegments
    ) {
        regionSupport.drawRoom(gc, cells, previewOffset, active, selected, openSegments, encodedOpenSegments);
    }

    void drawPaintPreview(GraphicsContext gc) {
        regionSupport.drawPaintPreview(gc);
    }

    void drawSelectionPreview(GraphicsContext gc) {
        regionSupport.drawSelectionPreview(gc);
    }

    Set<CorridorRenderKeys.CorridorSegmentKey> allDoorSegments() {
        return corridorSupport.allDoorSegments();
    }

    Set<Long> encodeSegments(Set<CorridorRenderKeys.CorridorSegmentKey> segments) {
        return regionSupport.encodeSegments(segments);
    }
}
