package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.base.DungeonCanvasTheme;
import features.world.dungeonmap.canvas.grid.DungeonGridInteractiveLabels;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.interaction.InteractiveLabelHandle;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.room.Room;
import javafx.geometry.Point2D;
import javafx.geometry.Rectangle2D;

public final class DungeonGridHitTester {

    private static final long CLUSTER_LABEL_PRIORITY = 100L;
    private static final long ROOM_TILE_PRIORITY = 10L;

    public DungeonEditorHitTarget hitTest(DungeonLayout layout, Point2D canvasPoint, DungeonCanvasCamera camera) {
        if (layout == null || canvasPoint == null || camera == null) {
            return null;
        }
        DungeonEditorHitTarget roomTarget = roomHit(layout, canvasPoint, camera);
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        DungeonEditorLabelHitTarget bestTarget = null;
        double bestDistance = Double.MAX_VALUE;
        for (RoomCluster cluster : layout.clusters()) {
            if (cluster == null || cluster.clusterId() == null) {
                continue;
            }
            InteractiveLabelHandle handle = cluster.labelHandle();
            Rectangle2D bounds = DungeonGridInteractiveLabels.bounds(handle, camera, gridSize);
            if (!bounds.contains(canvasPoint)) {
                continue;
            }
            DungeonEditorLabelHitTarget target = new DungeonEditorLabelHitTarget(
                    handle,
                    cluster.clusterId(),
                    CLUSTER_LABEL_PRIORITY);
            Point2D anchorPoint = DungeonGridInteractiveLabels.anchorPoint(handle, camera, gridSize);
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
        return bestTarget != null ? bestTarget : roomTarget;
    }

    private DungeonEditorHitTarget roomHit(DungeonLayout layout, Point2D canvasPoint, DungeonCanvasCamera camera) {
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        if (gridSize <= 0.0) {
            return null;
        }
        double worldX = (canvasPoint.getX() - camera.panX()) / gridSize;
        double worldY = (canvasPoint.getY() - camera.panY()) / gridSize;
        int cellX = (int) Math.floor(worldX);
        int cellY = (int) Math.floor(worldY);
        Room room = layout.roomAtCell(new features.world.dungeonmap.model.geometry.Point2i(cellX, cellY));
        if (room == null || room.roomId() == null) {
            return null;
        }
        return new DungeonEditorRoomHitTarget(room, ROOM_TILE_PRIORITY);
    }
}
