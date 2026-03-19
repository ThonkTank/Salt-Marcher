package features.world.quarantine.dungeonmap.canvas.grid;

import features.world.quarantine.dungeonmap.canvas.viewport.DungeonCanvasCamera;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import javafx.scene.canvas.GraphicsContext;

/**
 * Minimal contract for a grid-based dungeon rendering surface.
 * <p>
 * Implementations compose the capabilities of {@link DungeonBaseGridRenderer}
 * (grid rendering) and {@link DungeonBaseGridHitTester} (hit testing) into a
 * single coherent surface that callers can program against without depending on
 * concrete classes.
 */
public interface DungeonGridSurface {

    /**
     * Renders the dungeon grid to the given graphics context using the provided
     * layout and camera. Stateful implementations may use the parameters to
     * update their internal rendering state before drawing.
     */
    void renderGrid(GraphicsContext gc, DungeonLayout layout, DungeonCanvasCamera camera);

    /** Converts a screen position to the corresponding world-space grid cell. */
    Point2i worldPointAt(double screenX, double screenY);
}
