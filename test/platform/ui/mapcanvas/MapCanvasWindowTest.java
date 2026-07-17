package platform.ui.mapcanvas;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class MapCanvasWindowTest {

    @Test
    void reportsWhetherSceneBoundsIntersectTheVisibleWindow() {
        MapCanvasWindow window = new MapCanvasWindow(-2.0, -1.0, 5.0, 7.0);

        assertTrue(window.intersects(4.0, 6.0, 8.0, 9.0));
        assertFalse(window.intersects(6.0, 6.0, 8.0, 9.0));
        assertFalse(window.intersects(Double.NaN, 0.0, 1.0, 1.0));
    }
}
