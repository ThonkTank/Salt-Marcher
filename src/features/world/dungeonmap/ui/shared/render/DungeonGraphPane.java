package features.world.dungeonmap.ui.shared.render;

import features.world.dungeonmap.model.DungeonCorridor;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.Point2i;
import javafx.scene.canvas.GraphicsContext;

public final class DungeonGraphPane extends AbstractDungeonPane {

    private static final double NODE_RADIUS = 16;
    private static final double NODE_CENTER_RADIUS = 3;

    public DungeonGraphPane(DungeonCanvasCamera camera) {
        super(camera);
    }

    @Override
    protected void renderContent(GraphicsContext gc) {
        gc.setStroke(DungeonCanvasTheme.CORRIDOR);
        gc.setLineWidth(3);
        for (DungeonCorridor corridor : layout.corridors()) {
            DungeonRoom from = renderData == null ? null : renderData.roomById(corridor.fromRoomId());
            DungeonRoom to = renderData == null ? null : renderData.roomById(corridor.toRoomId());
            if (from == null || to == null) {
                continue;
            }
            Point2i fromCenter = previewCenter(from);
            Point2i toCenter = previewCenter(to);
            gc.strokeLine(
                    camera.toScreenX(fromCenter.x() + 0.5),
                    camera.toScreenY(fromCenter.y() + 0.5),
                    camera.toScreenX(toCenter.x() + 0.5),
                    camera.toScreenY(toCenter.y() + 0.5));
        }
        for (DungeonRoom room : layout.rooms()) {
            Point2i center = previewCenter(room);
            double screenX = camera.toScreenX(center.x() + 0.5);
            double screenY = camera.toScreenY(center.y() + 0.5);
            boolean active = isActive(room);
            boolean selected = isSelected(room);
            gc.setFill(active ? DungeonCanvasTheme.GRAPH_NODE_ACTIVE_FILL : DungeonCanvasTheme.GRAPH_NODE_FILL);
            gc.fillOval(screenX - NODE_RADIUS, screenY - NODE_RADIUS, NODE_RADIUS * 2, NODE_RADIUS * 2);
            gc.setStroke(selected ? DungeonCanvasTheme.ROOM_SELECTED_STROKE : DungeonCanvasTheme.ROOM_STROKE);
            gc.setLineWidth(selected ? 3 : 2);
            gc.strokeOval(screenX - NODE_RADIUS, screenY - NODE_RADIUS, NODE_RADIUS * 2, NODE_RADIUS * 2);
            gc.setFill(DungeonCanvasTheme.ROOM_CENTER);
            gc.fillOval(
                    screenX - NODE_CENTER_RADIUS,
                    screenY - NODE_CENTER_RADIUS,
                    NODE_CENTER_RADIUS * 2,
                    NODE_CENTER_RADIUS * 2);
            DungeonCanvasTheme.drawCenteredLabel(gc, room.name(), screenX, screenY);
        }
    }

    @Override
    protected Point2i worldPointAt(double screenX, double screenY) {
        int x = (int) Math.round(camera.toWorldX(screenX));
        int y = (int) Math.round(camera.toWorldY(screenY));
        return new Point2i(x, y);
    }

    @Override
    protected DungeonRoom findRoomAt(double screenX, double screenY) {
        DungeonRoom closest = null;
        double bestDistance = Double.POSITIVE_INFINITY;
        for (DungeonRoom room : layout.rooms()) {
            Point2i center = previewCenter(room);
            double centerX = camera.toScreenX(center.x() + 0.5);
            double centerY = camera.toScreenY(center.y() + 0.5);
            double distance = Math.hypot(centerX - screenX, centerY - screenY);
            if (distance < bestDistance && distance <= NODE_RADIUS) {
                bestDistance = distance;
                closest = room;
            }
        }
        return closest;
    }
}
