package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.base.DungeonCanvasTheme;
import features.world.dungeonmap.model.geometry.Point2i;
import javafx.geometry.Point2D;

public final class DungeonVertexHitService {

    public Point2i hitVertex(Point2D canvasPoint, DungeonCanvasCamera camera) {
        if (canvasPoint == null || camera == null) {
            return null;
        }
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        if (gridSize <= 0.0) {
            return null;
        }
        double gridX = (canvasPoint.getX() - camera.panX()) / gridSize;
        double gridY = (canvasPoint.getY() - camera.panY()) / gridSize;
        int vertexX = (int) Math.round(gridX);
        int vertexY = (int) Math.round(gridY);
        double snapX = camera.panX() + vertexX * gridSize;
        double snapY = camera.panY() + vertexY * gridSize;
        double maxDistance = DungeonHitConventions.pointTolerancePx(gridSize);
        return canvasPoint.distance(snapX, snapY) <= maxDistance ? new Point2i(vertexX, vertexY) : null;
    }
}
