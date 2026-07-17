package platform.ui.mapcanvas;

import java.util.EnumMap;
import java.util.Map;
import javafx.scene.canvas.Canvas;
import javafx.scene.layout.Pane;

/** JavaFX host for logical map paint layers on one bounded backing surface. */
public final class MapCanvasPane extends Pane {
    private final Map<MapCanvasLayer, Canvas> canvases = new EnumMap<>(MapCanvasLayer.class);

    public MapCanvasPane() {
        setFocusTraversable(true);
        setMinSize(0.0, 0.0);
        Canvas base = createCanvas(false);
        canvases.put(MapCanvasLayer.BASE, base);
        canvases.put(MapCanvasLayer.INTERACTION, base);
        canvases.put(MapCanvasLayer.ACTOR, base);
        getChildren().add(base);
    }

    public Canvas canvas(MapCanvasLayer layer) {
        MapCanvasLayer safeLayer = layer == null ? MapCanvasLayer.BASE : layer;
        return canvases.get(safeLayer);
    }

    private Canvas createCanvas(boolean mouseTransparent) {
        Canvas canvas = new Canvas();
        canvas.setMouseTransparent(mouseTransparent);
        canvas.widthProperty().bind(widthProperty());
        canvas.heightProperty().bind(heightProperty());
        return canvas;
    }
}
