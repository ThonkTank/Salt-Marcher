package features.dungeon.adapter.javafx.map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import features.dungeon.adapter.javafx.map.DungeonMapContentModel.Viewport;
import org.junit.jupiter.api.Test;

final class DungeonMapViewportDispatchTest {

    @Test
    void visibleBoundsFollowActualCanvasResizePanAndZoomAcrossNegativeCells() {
        Viewport initial = new Viewport(0.0, 0.0, 1.0);
        assertEquals(
                new DungeonMapVisibleCellBounds(0, 0, 9, 4),
                DungeonMapView.visibleCellBounds(initial, 320.0, 160.0));

        DungeonMapVisibleCellBounds resized =
                DungeonMapView.visibleCellBounds(initial, 640.0, 320.0);
        assertEquals(new DungeonMapVisibleCellBounds(0, 0, 19, 9), resized);

        DungeonMapVisibleCellBounds panned = DungeonMapView.visibleCellBounds(
                new Viewport(64.0, 32.0, 1.0), 640.0, 320.0);
        assertEquals(new DungeonMapVisibleCellBounds(-2, -1, 17, 8), panned);

        DungeonMapVisibleCellBounds zoomed = DungeonMapView.visibleCellBounds(
                new Viewport(64.0, 32.0, 2.0), 640.0, 320.0);
        assertEquals(new DungeonMapVisibleCellBounds(-1, -1, 8, 4), zoomed);
        assertNotEquals(panned, zoomed);
    }
}
