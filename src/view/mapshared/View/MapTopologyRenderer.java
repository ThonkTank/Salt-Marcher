package src.view.mapshared.View;
import javafx.scene.canvas.Canvas;
import src.view.mapshared.ViewModel.MapViewport;
import src.view.mapshared.ViewModel.MapWorkspaceRenderModel;
/**
 * Topology seam for reusable editor/runtime map rendering.
 */
interface MapTopologyRenderer {
    Canvas createCanvas();
    void render(Canvas canvas, MapWorkspaceRenderModel renderModel, MapViewport viewport);
}
