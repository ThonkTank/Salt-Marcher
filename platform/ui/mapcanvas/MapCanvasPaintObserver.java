package platform.ui.mapcanvas;

/** Feature-neutral sink for deterministic physical-layer paint evidence. */
@FunctionalInterface
public interface MapCanvasPaintObserver {
    void onPaint(MapCanvasPaintSample sample);

    static MapCanvasPaintObserver passive() {
        return ignored -> { };
    }
}
