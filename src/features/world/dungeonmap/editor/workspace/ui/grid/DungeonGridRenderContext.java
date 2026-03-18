package features.world.dungeonmap.editor.workspace.ui.grid;

import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.corridors.model.CorridorGeometry;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.foundation.geometry.Point2i;
import features.world.dungeonmap.canvas.rendering.CorridorRenderKeys;
import features.world.dungeonmap.canvas.rendering.DungeonBaseGridRenderer;
import javafx.scene.canvas.GraphicsContext;

import java.util.Set;

final class DungeonGridRenderContext implements DungeonBaseGridRenderer.RenderContext {

    private final DungeonGridPane pane;
    private final DungeonGridVisualSupport visualSupport;

    DungeonGridRenderContext(DungeonGridPane pane, DungeonGridVisualSupport visualSupport) {
        this.pane = pane;
        this.visualSupport = visualSupport;
    }

    @Override
    public DungeonLayout layout() {
        return pane.dungeonLayout();
    }

    @Override
    public Iterable<DungeonRoomCluster> clusters() {
        return pane.dungeonLayout().clusters();
    }

    @Override
    public CorridorGeometry corridorGeometryForDisplay(DungeonCorridor corridor) {
        return pane.corridorWorkspace().corridorGeometryForDisplay(corridor);
    }

    @Override
    public void drawGrid(GraphicsContext gc) {
        pane.drawGrid(gc);
    }

    @Override
    public void drawCorridors(GraphicsContext gc, Set<CorridorRenderKeys.CorridorSegmentKey> openSegments, Set<Long> encodedOpenSegments) {
        visualSupport.drawCorridors(gc, openSegments, encodedOpenSegments);
    }

    @Override
    public void drawRoom(GraphicsContext gc, DungeonRoomCluster cluster, Set<CorridorRenderKeys.CorridorSegmentKey> openSegments, Set<Long> encodedOpenSegments) {
        Set<Point2i> cells = pane.previewModel().clusterCellsFor(cluster);
        boolean active = pane.selectionState().isActive(cluster);
        boolean selected = pane.selectionState().isSelected(cluster);
        visualSupport.drawRoom(gc, cells, pane.previewModel().previewOffset(cluster.clusterId()), active, selected, openSegments, encodedOpenSegments);
    }

    @Override
    public void drawClusterAndRoomAnchors(GraphicsContext gc, DungeonRoomCluster cluster) {
        visualSupport.drawClusterAndRoomAnchors(gc, cluster);
    }

    @Override
    public void drawClusterEdges(GraphicsContext gc) {
        visualSupport.drawClusterEdges(gc);
    }

    @Override
    public void drawDoors(GraphicsContext gc) {
        visualSupport.drawDoors(gc);
    }
}
