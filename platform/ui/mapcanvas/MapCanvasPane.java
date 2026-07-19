package platform.ui.mapcanvas;

import java.util.EnumMap;
import java.util.Map;
import javafx.scene.canvas.Canvas;
import javafx.scene.layout.Pane;

/** JavaFX host for three independently painted map layers. */
public final class MapCanvasPane extends Pane {
    private final Map<MapCanvasLayer, Canvas> canvases = new EnumMap<>(MapCanvasLayer.class);

    public MapCanvasPane() {
        setFocusTraversable(false);
        setMinSize(0.0, 0.0);
        for (MapCanvasLayer layer : MapCanvasLayer.values()) {
            Canvas canvas = createCanvas(layer != MapCanvasLayer.BASE);
            canvases.put(layer, canvas);
            getChildren().add(canvas);
        }
    }

    public Canvas canvas(MapCanvasLayer layer) {
        MapCanvasLayer safeLayer = layer == null ? MapCanvasLayer.BASE : layer;
        return canvases.get(safeLayer);
    }

    public int canvasCount() {
        return canvases.size();
    }

    private Canvas createCanvas(boolean mouseTransparent) {
        Canvas canvas = new Canvas();
        canvas.setMouseTransparent(mouseTransparent);
        canvas.setFocusTraversable(!mouseTransparent);
        canvas.widthProperty().bind(widthProperty());
        canvas.heightProperty().bind(heightProperty());
        return canvas;
    }
}
