package platform.ui.mapcanvas;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

final class MapCanvasPaintSampleTest {

    @Test
    void preservesOneLayerPaintWorkSample() {
        MapCanvasPaintSample sample = new MapCanvasPaintSample(
                MapCanvasLayer.INTERACTION, 7L, 19L, 11L, 3L);

        assertEquals(MapCanvasLayer.INTERACTION, sample.layer());
        assertEquals(7L, sample.operationId());
        assertEquals(19L, sample.durationNanos());
        assertEquals(11L, sample.visitedPrimitives());
        assertEquals(3L, sample.paintedPrimitives());
    }

    @Test
    void rejectsImpossiblePaintCounts() {
        assertThrows(IllegalArgumentException.class, () -> new MapCanvasPaintSample(
                MapCanvasLayer.BASE, 1L, 1L, 1L, 2L));
    }
}
