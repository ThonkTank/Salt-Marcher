package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.base.DungeonCanvasTheme;
import features.world.dungeonmap.canvas.grid.DungeonGridInteractiveLabels;
import features.world.dungeonmap.model.DungeonLayout;
import javafx.geometry.Point2D;
import javafx.geometry.Rectangle2D;

public final class DungeonGridHitTester implements DungeonEditorHitTester {

    private final DungeonEditorLabelTargets labelTargets = new DungeonEditorLabelTargets();

    @Override
    public DungeonEditorHitTarget hitTest(DungeonLayout layout, Point2D canvasPoint, DungeonCanvasCamera camera) {
        if (layout == null || canvasPoint == null || camera == null) {
            return null;
        }
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        DungeonEditorLabelHitTarget bestTarget = null;
        double bestDistance = Double.MAX_VALUE;
        for (DungeonEditorLabelHitTarget target : labelTargets.forLayout(layout)) {
            Rectangle2D bounds = DungeonGridInteractiveLabels.bounds(target.handle(), camera, gridSize);
            if (!bounds.contains(canvasPoint)) {
                continue;
            }
            Point2D anchorPoint = DungeonGridInteractiveLabels.anchorPoint(target.handle(), camera, gridSize);
            double distance = anchorPoint.distance(canvasPoint);
            if (bestTarget == null
                    || target.priority() > bestTarget.priority()
                    || (target.priority() == bestTarget.priority() && distance < bestDistance)
                    || (target.priority() == bestTarget.priority()
                    && distance == bestDistance
                    && target.targetKey().compareTo(bestTarget.targetKey()) < 0)) {
                bestTarget = target;
                bestDistance = distance;
            }
        }
        return bestTarget;
    }
}
