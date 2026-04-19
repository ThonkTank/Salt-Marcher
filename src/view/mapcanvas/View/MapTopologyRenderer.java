package src.view.mapcanvas.View;
import javafx.scene.canvas.Canvas;
import src.view.mapcanvas.api.MapCanvasViewport;
import src.view.mapcanvas.api.MapCanvasRenderModel;
/**
 * Topology seam for reusable editor/runtime map rendering.
 */
interface MapTopologyRenderer {
    Canvas createCanvas();
    void render(Canvas canvas, MapCanvasRenderModel renderModel, MapCanvasViewport viewport);
}
