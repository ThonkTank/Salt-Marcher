package src.view.mapcanvas.api;

import java.util.function.Consumer;
import java.util.function.IntConsumer;

public record MapCanvasCallbacks(
        Consumer<MapCanvasCell> cellSelectionListener,
        Consumer<MapCanvasViewport> viewportListener,
        IntConsumer floorStepListener
) {

    public MapCanvasCallbacks {
        cellSelectionListener = cellSelectionListener == null ? ignored -> { } : cellSelectionListener;
        viewportListener = viewportListener == null ? ignored -> { } : viewportListener;
        floorStepListener = floorStepListener == null ? ignored -> { } : floorStepListener;
    }

    public static MapCanvasCallbacks none() {
        return new MapCanvasCallbacks(ignored -> { }, ignored -> { }, ignored -> { });
    }
}
