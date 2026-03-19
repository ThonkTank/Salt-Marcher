package features.world.dungeonmap.canvas.grid;

import features.world.dungeonmap.canvas.base.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.base.DungeonCanvasTheme;
import features.world.dungeonmap.canvas.base.DungeonSceneRenderer;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.objects.TileShape;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.room.Room;
import javafx.scene.canvas.GraphicsContext;

import java.util.Set;

public final class DungeonGridSceneRenderer implements DungeonSceneRenderer {

    @Override
    public void render(GraphicsContext gc, double width, double height, DungeonLayout mapModel, DungeonCanvasCamera camera, boolean editorMode) {
        fillBackground(gc, width, height, editorMode);
        drawGrid(gc, width, height, camera, editorMode);
        drawRooms(gc, mapModel, camera, editorMode);
        drawAxes(gc, width, height, camera, editorMode);
    }

    private static void fillBackground(GraphicsContext gc, double width, double height, boolean editorMode) {
        gc.setFill(DungeonCanvasTheme.background(editorMode));
        gc.fillRect(0, 0, width, height);
    }

    private static void drawGrid(GraphicsContext gc, double width, double height, DungeonCanvasCamera camera, boolean editorMode) {
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        double offsetX = normalizedOffset(camera.panX(), gridSize);
        double offsetY = normalizedOffset(camera.panY(), gridSize);
        gc.setStroke(DungeonCanvasTheme.grid(editorMode));
        gc.setLineWidth(1);
        for (double x = offsetX; x <= width; x += gridSize) {
            gc.strokeLine(x, 0, x, height);
        }
        for (double y = offsetY; y <= height; y += gridSize) {
            gc.strokeLine(0, y, width, y);
        }
    }

    private static void drawRooms(GraphicsContext gc, DungeonLayout mapModel, DungeonCanvasCamera camera, boolean editorMode) {
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        gc.setFill(DungeonCanvasTheme.CELL_FILL);
        gc.setStroke(DungeonCanvasTheme.CELL_STROKE);
        gc.setLineWidth(1.5);
        for (RoomCluster cluster : mapModel.clusters()) {
            for (Room room : cluster.rooms()) {
                TileShape geometry = room.geometry();
                fillRoomCells(gc, camera, gridSize, geometry.absoluteCells());
                strokeRoomCells(gc, camera, gridSize, geometry.absoluteCells());
                gc.setFill(DungeonCanvasTheme.text(editorMode));
                gc.setFont(DungeonCanvasTheme.ROOM_LABEL_FONT);
                drawRoomLabel(gc, room.name(), camera, gridSize, geometry);
                gc.setFill(DungeonCanvasTheme.CELL_FILL);
            }
        }
    }

    private static void fillRoomCells(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            double gridSize,
            Set<Point2i> cells
    ) {
        for (Point2i cell : cells) {
            double x = camera.panX() + cell.x() * gridSize;
            double y = camera.panY() + cell.y() * gridSize;
            gc.fillRect(x, y, gridSize, gridSize);
        }
    }

    private static void strokeRoomCells(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            double gridSize,
            Set<Point2i> cells
    ) {
        for (Point2i cell : cells) {
            double x = camera.panX() + cell.x() * gridSize;
            double y = camera.panY() + cell.y() * gridSize;
            gc.strokeRect(x, y, gridSize, gridSize);
        }
    }

    private static void drawRoomLabel(
            GraphicsContext gc,
            String roomName,
            DungeonCanvasCamera camera,
            double gridSize,
            TileShape geometry
    ) {
        if (roomName == null || roomName.isBlank()) {
            return;
        }
        double centerX = camera.panX() + (geometry.anchor().x() + 0.15) * gridSize;
        double centerY = camera.panY() + (geometry.anchor().y() + 0.55) * gridSize;
        gc.fillText(roomName, centerX, centerY);
    }

    private static void drawAxes(GraphicsContext gc, double width, double height, DungeonCanvasCamera camera, boolean editorMode) {
        gc.setStroke(DungeonCanvasTheme.axis(editorMode));
        gc.setLineWidth(2);
        gc.strokeLine(width / 2.0 + camera.panX(), 0, width / 2.0 + camera.panX(), height);
        gc.strokeLine(0, height / 2.0 + camera.panY(), width, height / 2.0 + camera.panY());
    }

    private static double normalizedOffset(double pan, double gridSize) {
        if (gridSize <= 0.0) {
            return 0.0;
        }
        double offset = pan % gridSize;
        return offset < 0 ? offset + gridSize : offset;
    }
}
