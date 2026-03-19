package features.world.dungeonmap.canvas.graph;

import features.world.dungeonmap.canvas.base.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.base.DungeonCanvasTheme;
import features.world.dungeonmap.canvas.base.DungeonSceneRenderer;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import javafx.geometry.Point2D;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.text.TextAlignment;

import java.util.LinkedHashMap;
import java.util.Map;

public final class DungeonGraphSceneRenderer implements DungeonSceneRenderer {

    @Override
    public void render(GraphicsContext gc, double width, double height, DungeonLayout mapModel, DungeonCanvasCamera camera, boolean editorMode) {
        gc.setFill(DungeonCanvasTheme.background(editorMode));
        gc.fillRect(0, 0, width, height);
        Map<Long, Point2D> positions = graphPositions(mapModel, width, height, camera);
        drawLinks(gc, mapModel, positions, editorMode);
        drawNodes(gc, mapModel, positions);
    }

    private static void drawLinks(GraphicsContext gc, DungeonLayout mapModel, Map<Long, Point2D> positions, boolean editorMode) {
        gc.setStroke(editorMode ? DungeonCanvasTheme.axis(editorMode) : DungeonCanvasTheme.GRAPH_LINK);
        gc.setLineWidth(3);
        for (Corridor corridor : mapModel.corridors()) {
            for (Corridor.RoomLink roomLink : corridor.roomLinks()) {
                Point2D from = positions.get(roomLink.fromRoomId());
                Point2D to = positions.get(roomLink.toRoomId());
                if (from == null || to == null) {
                    continue;
                }
                gc.strokeLine(from.getX(), from.getY(), to.getX(), to.getY());
            }
        }
    }

    private static void drawNodes(GraphicsContext gc, DungeonLayout mapModel, Map<Long, Point2D> positions) {
        gc.setTextAlign(TextAlignment.CENTER);
        gc.setFont(DungeonCanvasTheme.GRAPH_NODE_FONT);
        for (Room room : mapModel.rooms()) {
            Point2D point = positions.get(room.roomId());
            if (point == null) {
                continue;
            }
            gc.setFill(DungeonCanvasTheme.GRAPH_NODE_FILL);
            gc.fillRoundRect(point.getX() - 42, point.getY() - 18, 84, 36, 18, 18);
            gc.setStroke(DungeonCanvasTheme.GRAPH_NODE_STROKE);
            gc.setLineWidth(2);
            gc.strokeRoundRect(point.getX() - 42, point.getY() - 18, 84, 36, 18, 18);
            gc.setFill(DungeonCanvasTheme.GRAPH_NODE_TEXT);
            gc.fillText(room.name(), point.getX(), point.getY() + 4);
        }
        gc.setTextAlign(TextAlignment.LEFT);
    }

    private static Map<Long, Point2D> graphPositions(DungeonLayout mapModel, double width, double height, DungeonCanvasCamera camera) {
        Map<Long, Point2D> positions = new LinkedHashMap<>();
        int count = Math.max(mapModel.rooms().size(), 1);
        double radius = 130 * camera.zoom();
        double centerX = width / 2.0 + camera.panX();
        double centerY = height / 2.0 + camera.panY();
        for (int index = 0; index < mapModel.rooms().size(); index++) {
            Room room = mapModel.rooms().get(index);
            double angle = (-Math.PI / 2.0) + ((Math.PI * 2.0) * index / count);
            positions.put(room.roomId(), new Point2D(
                    centerX + Math.cos(angle) * radius,
                    centerY + Math.sin(angle) * radius));
        }
        return positions;
    }
}
