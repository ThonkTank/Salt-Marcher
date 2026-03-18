package features.world.dungeonmap.canvas.rendering;

import features.world.dungeonmap.layout.model.DungeonLayout;
import javafx.geometry.Point2D;

import java.util.Objects;

public final class DungeonViewportController {

    private final DungeonCanvasCamera camera;
    private DungeonCanvasBounds bounds = DungeonCanvasBounds.defaultBounds();
    private DungeonLayout layout;

    public DungeonViewportController(DungeonCanvasCamera camera) {
        this.camera = Objects.requireNonNull(camera, "camera");
    }

    public void updateState(DungeonLayout layout, DungeonCanvasBounds bounds) {
        this.layout = layout;
        this.bounds = bounds;
    }

    public boolean shouldResetView(DungeonLayout nextLayout) {
        if (layout == null || layout.map() == null) {
            return nextLayout != null;
        }
        if (nextLayout == null || nextLayout.map() == null) {
            return true;
        }
        return !Objects.equals(layout.map().mapId(), nextLayout.map().mapId());
    }

    public void beginPan(Point2D point) {
        camera.beginPan(point.getX(), point.getY());
    }

    public void updatePan(Point2D point, Runnable refreshAction) {
        camera.updatePan(point.getX(), point.getY());
        refreshAction.run();
    }

    public void zoomAt(double screenX, double screenY, double factor, Runnable refreshAction) {
        camera.zoomAt(screenX, screenY, factor);
        refreshAction.run();
    }

    public void refreshViewport(double width, double height, boolean resetView, Runnable refreshAction) {
        camera.showBounds(bounds, Math.max(160, width), Math.max(160, height), resetView);
        refreshAction.run();
    }
}
