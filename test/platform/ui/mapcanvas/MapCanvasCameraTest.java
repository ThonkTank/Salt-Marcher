package platform.ui.mapcanvas;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

final class MapCanvasCameraTest {
    @Test
    void zoomKeepsTheScenePointUnderThePointerStable() {
        MapCanvasCamera camera = new MapCanvasCamera(32.0, 1.0, 0.1, 4.0);
        double sceneX = camera.viewport().screenToSceneX(320.0);
        double sceneY = camera.viewport().screenToSceneY(160.0);

        MapCanvasViewport zoomed = camera.zoomAround(320.0, 160.0, 2.0);

        assertEquals(sceneX, zoomed.screenToSceneX(320.0), 0.000_001);
        assertEquals(sceneY, zoomed.screenToSceneY(160.0), 0.000_001);
    }

    @Test
    void visibleWindowSupportsNegativeUnboundedSceneCoordinates() {
        MapCanvasCamera camera = new MapCanvasCamera(32.0, 1.0, 0.1, 4.0);
        camera.panByPixels(640.0, 320.0);

        MapCanvasWindow window = MapCanvasWindow.visible(camera.viewport(), 960.0, 640.0, 64.0);

        assertTrue(window.minX() < 0.0);
        assertTrue(window.minY() < 0.0);
        assertTrue(window.maxX() > window.minX());
    }
}
