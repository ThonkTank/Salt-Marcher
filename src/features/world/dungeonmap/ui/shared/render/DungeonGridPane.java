package features.world.dungeonmap.ui.shared.render;

import features.world.dungeonmap.model.DungeonCorridor;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.Point2i;
import features.world.dungeonmap.service.DungeonGeometry;
import javafx.scene.canvas.GraphicsContext;

import java.util.List;
import java.util.Set;

public final class DungeonGridPane extends AbstractDungeonPane {

    public DungeonGridPane(DungeonCanvasCamera camera) {
        super(camera);
    }

    @Override
    protected void renderContent(GraphicsContext gc) {
        drawGrid(gc);

        gc.setStroke(DungeonCanvasTheme.CORRIDOR);
        gc.setLineWidth(4);
        for (DungeonCorridor corridor : layout.corridors()) {
            List<Point2i> path = renderData == null ? null : renderData.corridorPath(corridor.corridorId());
            if (path == null || path.size() < 2) {
                continue;
            }
            for (int i = 1; i < path.size(); i++) {
                Point2i from = path.get(i - 1);
                Point2i to = path.get(i);
                gc.strokeLine(camera.toScreenX(from.x() + 0.5), camera.toScreenY(from.y() + 0.5),
                        camera.toScreenX(to.x() + 0.5), camera.toScreenY(to.y() + 0.5));
            }
        }

        for (DungeonRoom room : layout.rooms()) {
            Point2i center = previewCenter(room);
            List<Point2i> polygon = polygonFor(room, center);
            double[] xs = new double[polygon.size()];
            double[] ys = new double[polygon.size()];
            for (int i = 0; i < polygon.size(); i++) {
                xs[i] = camera.toScreenX(polygon.get(i).x());
                ys[i] = camera.toScreenY(polygon.get(i).y());
            }
            boolean active = isActive(room);
            boolean selected = isSelected(room);
            gc.setFill(active ? DungeonCanvasTheme.ROOM_ACTIVE_FILL : DungeonCanvasTheme.ROOM_FILL);
            gc.fillPolygon(xs, ys, polygon.size());
            gc.setStroke(selected ? DungeonCanvasTheme.ROOM_SELECTED_STROKE : DungeonCanvasTheme.ROOM_STROKE);
            gc.setLineWidth(selected ? 3 : 2);
            gc.strokePolygon(xs, ys, polygon.size());
            double centerX = camera.toScreenX(center.x() + 0.5);
            double centerY = camera.toScreenY(center.y() + 0.5);
            gc.setFill(DungeonCanvasTheme.ROOM_CENTER);
            gc.fillOval(centerX - 4, centerY - 4, 8, 8);
            DungeonCanvasTheme.drawCenteredLabel(gc, room.name(), centerX, centerY);
        }
    }

    private void drawGrid(GraphicsContext gc) {
        gc.setStroke(DungeonCanvasTheme.GRID_LINE);
        gc.setLineWidth(1);
        for (int x = camera.visibleMinWorldX(); x <= camera.visibleMaxWorldX() + 1; x++) {
            double screenX = camera.toScreenX(x);
            gc.strokeLine(screenX, 0, screenX, canvas.getHeight());
        }
        for (int y = camera.visibleMinWorldY(); y <= camera.visibleMaxWorldY() + 1; y++) {
            double screenY = camera.toScreenY(y);
            gc.strokeLine(0, screenY, canvas.getWidth(), screenY);
        }
    }

    @Override
    protected DungeonRoom findRoomAt(double screenX, double screenY) {
        Point2i cell = worldPointAt(screenX, screenY);
        for (DungeonRoom room : layout.rooms()) {
            Set<Point2i> roomCells = cellsFor(room);
            if (roomCells != null && roomCells.contains(cell)) {
                return room;
            }
        }
        return null;
    }

    @Override
    protected Point2i worldPointAt(double screenX, double screenY) {
        int x = (int) Math.floor(camera.toWorldX(screenX));
        int y = (int) Math.floor(camera.toWorldY(screenY));
        return new Point2i(x, y);
    }

    private List<Point2i> polygonFor(DungeonRoom room, Point2i center) {
        if (room == null) {
            return List.of();
        }
        if (room.center().equals(center) && renderData != null) {
            List<Point2i> polygon = renderData.roomPolygon(room.roomId());
            if (polygon != null) {
                return polygon;
            }
        }
        return room.relativeVertices().stream().map(center::add).toList();
    }

    private Set<Point2i> cellsFor(DungeonRoom room) {
        if (room == null) {
            return null;
        }
        Point2i previewCenter = previewCenters.get(room.roomId());
        if (previewCenter == null && renderData != null) {
            return renderData.roomCells(room.roomId());
        }
        Point2i center = previewCenter == null ? room.center() : previewCenter;
        DungeonRoom resolved = new DungeonRoom(room.roomId(), room.mapId(), room.name(), center, room.relativeVertices());
        return DungeonGeometry.roomCells(resolved);
    }
}
