package features.world.dungeonmap.canvas.grid;

import features.world.dungeonmap.canvas.base.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.base.DungeonCanvasTheme;
import features.world.dungeonmap.canvas.base.DungeonSceneRenderer;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Tile;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.geometry.VertexEdge;
import features.world.dungeonmap.model.interaction.InteractiveLabelHandle;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.room.Room;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.text.TextAlignment;

import java.util.LinkedHashSet;
import java.util.Set;

public final class DungeonGridSceneRenderer implements DungeonSceneRenderer {

    @Override
    public void render(
            GraphicsContext gc,
            double width,
            double height,
            DungeonLayout mapModel,
            DungeonCanvasCamera camera,
            boolean editorMode,
            String selectedTargetKey,
            TileShape previewPaintShape,
            boolean previewPaintDeleteMode
    ) {
        fillBackground(gc, width, height, editorMode);
        drawGrid(gc, width, height, camera, editorMode);
        if (editorMode) {
            drawPaintPreview(gc, camera, previewPaintShape, previewPaintDeleteMode);
        }
        drawRooms(gc, mapModel, camera, editorMode);
        if (editorMode) {
            drawInteractiveLabels(gc, mapModel, camera, selectedTargetKey);
        }
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
        Set<VertexEdge> roomBoundaryEdges = new LinkedHashSet<>();
        for (RoomCluster cluster : mapModel.clusters()) {
            for (Room room : cluster.rooms()) {
                Set<Tile> tiles = room.floor().shape().tiles();
                fillRoomTiles(gc, camera, gridSize, tiles);
                strokeRoomTiles(gc, camera, gridSize, tiles, DungeonCanvasTheme.grid(editorMode), 1.0);
                room.walls().forEach(wall -> roomBoundaryEdges.addAll(wall.edges()));
                if (!editorMode) {
                    gc.setFill(DungeonCanvasTheme.text(editorMode));
                    gc.setFont(DungeonCanvasTheme.ROOM_LABEL_FONT);
                    drawRoomLabel(gc, room.name(), camera, gridSize, room);
                    gc.setFill(DungeonCanvasTheme.CELL_FILL);
                }
            }
        }
        drawRoomBoundaries(gc, camera, gridSize, roomBoundaryEdges);
    }

    private static void fillRoomTiles(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            double gridSize,
            Set<Tile> tiles
    ) {
        for (Tile tile : tiles) {
            double x = camera.panX() + tile.x() * gridSize;
            double y = camera.panY() + tile.y() * gridSize;
            gc.fillRect(x, y, gridSize, gridSize);
        }
    }

    private static void strokeRoomTiles(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            double gridSize,
            Set<Tile> tiles,
            javafx.scene.paint.Color stroke,
            double lineWidth
    ) {
        gc.setStroke(stroke);
        gc.setLineWidth(lineWidth);
        for (Tile tile : tiles) {
            double x = camera.panX() + tile.x() * gridSize;
            double y = camera.panY() + tile.y() * gridSize;
            gc.strokeRect(x, y, gridSize, gridSize);
        }
    }

    private static void drawRoomBoundaries(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            double gridSize,
            Set<VertexEdge> edges
    ) {
        if (edges.isEmpty()) {
            return;
        }
        gc.setStroke(DungeonCanvasTheme.WALL_STROKE);
        gc.setLineWidth(2.0);
        for (VertexEdge edge : edges) {
            strokeEdge(gc, camera, gridSize, edge);
        }
    }

    private static void strokeEdge(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            double gridSize,
            VertexEdge edge
    ) {
        double startX = camera.panX() + edge.start().x() * gridSize;
        double startY = camera.panY() + edge.start().y() * gridSize;
        double endX = camera.panX() + edge.end().x() * gridSize;
        double endY = camera.panY() + edge.end().y() * gridSize;
        gc.strokeLine(startX, startY, endX, endY);
    }

    private static void drawRoomLabel(
            GraphicsContext gc,
            String roomName,
            DungeonCanvasCamera camera,
            double gridSize,
            Room room
    ) {
        if (roomName == null || roomName.isBlank()) {
            return;
        }
        double centerX = camera.panX() + (room.floor().shape().anchor().x() + 0.15) * gridSize;
        double centerY = camera.panY() + (room.floor().shape().anchor().y() + 0.55) * gridSize;
        gc.fillText(roomName, centerX, centerY);
    }

    private static void drawInteractiveLabels(
            GraphicsContext gc,
            DungeonLayout mapModel,
            DungeonCanvasCamera camera,
            String selectedTargetKey
    ) {
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        gc.setFont(DungeonCanvasTheme.HUD_FONT);
        gc.setTextAlign(TextAlignment.CENTER);
        for (RoomCluster cluster : mapModel.clusters()) {
            InteractiveLabelHandle handle = cluster.labelHandle();
            javafx.geometry.Rectangle2D bounds = DungeonGridInteractiveLabels.bounds(handle, camera, gridSize);
            boolean selected = handle != null && java.util.Objects.equals(handle.key(), selectedTargetKey);
            gc.setFill(selected ? DungeonCanvasTheme.GRAPH_NODE_FILL : DungeonCanvasTheme.LABEL_FILL);
            gc.fillRoundRect(bounds.getMinX(), bounds.getMinY(), bounds.getWidth(), bounds.getHeight(), 14, 14);
            gc.setStroke(selected ? DungeonCanvasTheme.GRAPH_NODE_STROKE : DungeonCanvasTheme.LABEL_BORDER);
            gc.setLineWidth(selected ? 2.0 : 1.0);
            gc.strokeRoundRect(bounds.getMinX(), bounds.getMinY(), bounds.getWidth(), bounds.getHeight(), 14, 14);
            gc.setFill(DungeonCanvasTheme.LABEL_TEXT);
            gc.fillText(handle.label(), bounds.getMinX() + bounds.getWidth() / 2.0, bounds.getMinY() + 16.5);
        }
        gc.setTextAlign(TextAlignment.LEFT);
    }

    private static void drawPaintPreview(
            GraphicsContext gc,
            DungeonCanvasCamera camera,
            TileShape previewPaintShape,
            boolean deleteMode
    ) {
        if (previewPaintShape == null || previewPaintShape.size() == 0) {
            return;
        }
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        gc.setFill(deleteMode ? DungeonCanvasTheme.DELETE_PREVIEW_FILL : DungeonCanvasTheme.PAINT_PREVIEW_FILL);
        gc.setStroke(deleteMode ? DungeonCanvasTheme.DELETE_PREVIEW_STROKE : DungeonCanvasTheme.PAINT_PREVIEW_STROKE);
        gc.setLineWidth(1.5);
        for (Tile tile : previewPaintShape.tiles()) {
            double x = camera.panX() + tile.x() * gridSize;
            double y = camera.panY() + tile.y() * gridSize;
            gc.fillRect(x, y, gridSize, gridSize);
            gc.strokeRect(x, y, gridSize, gridSize);
        }
    }

    private static void drawAxes(GraphicsContext gc, double width, double height, DungeonCanvasCamera camera, boolean editorMode) {
        gc.setStroke(DungeonCanvasTheme.axis(editorMode));
        gc.setLineWidth(2);
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        double axisX = camera.panX();
        double axisY = camera.panY();
        if (axisX >= -gridSize && axisX <= width + gridSize) {
            gc.strokeLine(axisX, 0, axisX, height);
        }
        if (axisY >= -gridSize && axisY <= height + gridSize) {
            gc.strokeLine(0, axisY, width, axisY);
        }
    }

    private static double normalizedOffset(double pan, double gridSize) {
        if (gridSize <= 0.0) {
            return 0.0;
        }
        double offset = pan % gridSize;
        return offset < 0 ? offset + gridSize : offset;
    }
}
