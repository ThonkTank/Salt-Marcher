package features.world.quarantine.dungeonmap.editor.workspace.grid;

import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorGeometry;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.canvas.state.CorridorRenderKeys;
import features.world.quarantine.dungeonmap.canvas.grid.DungeonBaseGridRenderer;
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
        return pane.interactions().corridorWorkspace().corridorInteractionSupport().corridorGeometryForDisplay(corridor);
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
        Set<Point2i> cells = pane.interactions().previewModel().geometry().clusterCellsFor(cluster);
        boolean active = pane.sceneState().isActive(cluster);
        boolean selected = pane.sceneState().isSelected(cluster);
        visualSupport.drawRoom(gc, cells, pane.interactions().previewModel().geometry().previewOffset(cluster.clusterId()), active, selected, openSegments, encodedOpenSegments);
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
