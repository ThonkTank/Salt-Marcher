package features.world.dungeonmap.ui.shared;

import features.world.dungeonmap.model.DungeonCorridor;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.Point2i;
import features.world.dungeonmap.service.DungeonGeometry;
import javafx.scene.canvas.Canvas;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.input.MouseEvent;
import javafx.scene.layout.StackPane;
import javafx.scene.paint.Color;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.BiConsumer;
import java.util.function.Consumer;

public final class DungeonGridPane extends StackPane {

    private final Canvas canvas = new Canvas();
    private DungeonLayout layout;
    private Long selectedRoomId;
    private Long activeRoomId;
    private boolean editable;
    private Consumer<DungeonRoom> onRoomSelected = room -> { };
    private BiConsumer<DungeonRoom, Point2i> onRoomMoved = (room, center) -> { };
    private final Map<Long, Point2i> previewCenters = new HashMap<>();
    private DungeonRoom draggingRoom;
    private Point2i dragAnchorWorld;
    private Point2i dragOriginalCenter;

    public DungeonGridPane() {
        getChildren().add(canvas);
        widthProperty().addListener((obs, oldValue, newValue) -> resizeCanvas());
        heightProperty().addListener((obs, oldValue, newValue) -> resizeCanvas());
        canvas.addEventHandler(MouseEvent.MOUSE_PRESSED, this::handleMousePressed);
        canvas.addEventHandler(MouseEvent.MOUSE_DRAGGED, this::handleMouseDragged);
        canvas.addEventHandler(MouseEvent.MOUSE_RELEASED, this::handleMouseReleased);
    }

    public void setOnRoomSelected(Consumer<DungeonRoom> onRoomSelected) {
        this.onRoomSelected = Objects.requireNonNull(onRoomSelected, "onRoomSelected");
    }

    public void setOnRoomMoved(BiConsumer<DungeonRoom, Point2i> onRoomMoved) {
        this.onRoomMoved = Objects.requireNonNull(onRoomMoved, "onRoomMoved");
    }

    public void setEditable(boolean editable) {
        this.editable = editable;
    }

    public void showLayout(DungeonLayout layout, Long selectedRoomId, Long activeRoomId) {
        this.layout = layout;
        this.selectedRoomId = selectedRoomId;
        this.activeRoomId = activeRoomId;
        this.previewCenters.clear();
        render();
    }

    private void resizeCanvas() {
        canvas.setWidth(Math.max(160, getWidth()));
        canvas.setHeight(Math.max(160, getHeight()));
        render();
    }

    private void render() {
        GraphicsContext gc = canvas.getGraphicsContext2D();
        gc.setFill(Color.web("#f6f1e8"));
        gc.fillRect(0, 0, canvas.getWidth(), canvas.getHeight());
        if (layout == null) {
            return;
        }

        Viewport viewport = Viewport.forLayout(layout.rooms(), canvas.getWidth(), canvas.getHeight(), 32, true);
        drawGrid(gc, viewport);

        Map<Long, List<Point2i>> corridorPaths = DungeonGeometry.corridorPaths(layout);
        gc.setStroke(Color.web("#8d8d8d"));
        gc.setLineWidth(4);
        for (DungeonCorridor corridor : layout.corridors()) {
            List<Point2i> path = corridorPaths.get(corridor.corridorId());
            if (path == null || path.size() < 2) {
                continue;
            }
            for (int i = 1; i < path.size(); i++) {
                Point2i from = path.get(i - 1);
                Point2i to = path.get(i);
                gc.strokeLine(viewport.toScreenX(from.x() + 0.5), viewport.toScreenY(from.y() + 0.5),
                        viewport.toScreenX(to.x() + 0.5), viewport.toScreenY(to.y() + 0.5));
            }
        }

        for (DungeonRoom room : layout.rooms()) {
            Point2i center = previewCenters.getOrDefault(room.roomId(), room.center());
            List<Point2i> polygon = room.relativeVertices().stream().map(center::add).toList();
            double[] xs = new double[polygon.size()];
            double[] ys = new double[polygon.size()];
            for (int i = 0; i < polygon.size(); i++) {
                xs[i] = viewport.toScreenX(polygon.get(i).x());
                ys[i] = viewport.toScreenY(polygon.get(i).y());
            }
            boolean active = room.roomId() != null && room.roomId().equals(activeRoomId);
            boolean selected = room.roomId() != null && room.roomId().equals(selectedRoomId);
            gc.setFill(active ? Color.web("#b9d7a8") : Color.web("#d9c59c"));
            gc.fillPolygon(xs, ys, polygon.size());
            gc.setStroke(selected ? Color.web("#b65427") : Color.web("#4d3926"));
            gc.setLineWidth(selected ? 3 : 2);
            gc.strokePolygon(xs, ys, polygon.size());
            gc.setFill(Color.web("#2d241a"));
            gc.fillOval(viewport.toScreenX(center.x() + 0.5) - 4, viewport.toScreenY(center.y() + 0.5) - 4, 8, 8);
            gc.fillText(room.name(), viewport.toScreenX(center.x() + 0.7), viewport.toScreenY(center.y() - 0.2));
        }
    }

    private void drawGrid(GraphicsContext gc, Viewport viewport) {
        gc.setStroke(Color.web("#e2d8c8"));
        gc.setLineWidth(1);
        for (int x = viewport.minWorldX; x <= viewport.maxWorldX + 1; x++) {
            double screenX = viewport.toScreenX(x);
            gc.strokeLine(screenX, 0, screenX, canvas.getHeight());
        }
        for (int y = viewport.minWorldY; y <= viewport.maxWorldY + 1; y++) {
            double screenY = viewport.toScreenY(y);
            gc.strokeLine(0, screenY, canvas.getWidth(), screenY);
        }
    }

    private void handleMousePressed(MouseEvent event) {
        if (layout == null) {
            return;
        }
        Point2i world = worldCellAt(event.getX(), event.getY());
        DungeonRoom room = findRoomAt(world);
        if (room != null) {
            onRoomSelected.accept(room);
            if (editable) {
                draggingRoom = room;
                dragAnchorWorld = world;
                dragOriginalCenter = room.center();
            }
        }
    }

    private void handleMouseDragged(MouseEvent event) {
        if (!editable || draggingRoom == null || dragAnchorWorld == null || dragOriginalCenter == null) {
            return;
        }
        Point2i world = worldCellAt(event.getX(), event.getY());
        Point2i delta = world.subtract(dragAnchorWorld);
        previewCenters.put(draggingRoom.roomId(), dragOriginalCenter.add(delta));
        render();
    }

    private void handleMouseReleased(MouseEvent event) {
        if (!editable || draggingRoom == null || dragOriginalCenter == null || dragAnchorWorld == null) {
            draggingRoom = null;
            dragOriginalCenter = null;
            dragAnchorWorld = null;
            return;
        }
        Point2i world = worldCellAt(event.getX(), event.getY());
        Point2i delta = world.subtract(dragAnchorWorld);
        Point2i newCenter = dragOriginalCenter.add(delta);
        previewCenters.remove(draggingRoom.roomId());
        onRoomMoved.accept(draggingRoom, newCenter);
        draggingRoom = null;
        dragOriginalCenter = null;
        dragAnchorWorld = null;
        render();
    }

    private DungeonRoom findRoomAt(Point2i cell) {
        for (DungeonRoom room : layout.rooms()) {
            Point2i center = previewCenters.getOrDefault(room.roomId(), room.center());
            DungeonRoom resolved = new DungeonRoom(room.roomId(), room.mapId(), room.name(), center, room.relativeVertices());
            if (DungeonGeometry.roomCells(resolved).contains(cell)) {
                return room;
            }
        }
        return null;
    }

    private Point2i worldCellAt(double screenX, double screenY) {
        Viewport viewport = Viewport.forLayout(layout.rooms(), canvas.getWidth(), canvas.getHeight(), 32, true);
        int x = (int) Math.floor((screenX - viewport.offsetX) / viewport.cellSize);
        int y = (int) Math.floor((screenY - viewport.offsetY) / viewport.cellSize);
        return new Point2i(x, y);
    }

    static final class Viewport {
        private final double cellSize;
        private final double offsetX;
        private final double offsetY;
        private final int minWorldX;
        private final int maxWorldX;
        private final int minWorldY;
        private final int maxWorldY;

        private Viewport(double cellSize, double offsetX, double offsetY, int minWorldX, int maxWorldX, int minWorldY, int maxWorldY) {
            this.cellSize = cellSize;
            this.offsetX = offsetX;
            this.offsetY = offsetY;
            this.minWorldX = minWorldX;
            this.maxWorldX = maxWorldX;
            this.minWorldY = minWorldY;
            this.maxWorldY = maxWorldY;
        }

        static Viewport forLayout(List<DungeonRoom> rooms, double width, double height, double requestedCellSize, boolean invertY) {
            int minX = -8;
            int maxX = 8;
            int minY = -8;
            int maxY = 8;
            for (DungeonRoom room : rooms) {
                List<Point2i> polygon = DungeonGeometry.absolutePolygon(room);
                for (Point2i point : polygon) {
                    minX = Math.min(minX, point.x() - 2);
                    maxX = Math.max(maxX, point.x() + 2);
                    minY = Math.min(minY, point.y() - 2);
                    maxY = Math.max(maxY, point.y() + 2);
                }
            }
            double availableWidth = Math.max(1, width - 40);
            double availableHeight = Math.max(1, height - 40);
            double cellSize = Math.min(requestedCellSize,
                    Math.min(availableWidth / Math.max(1, maxX - minX + 1), availableHeight / Math.max(1, maxY - minY + 1)));
            double offsetX = 20 - minX * cellSize;
            double offsetY = invertY ? height - 20 + minY * cellSize : 20 - minY * cellSize;
            return new Viewport(cellSize, offsetX, offsetY, minX, maxX, minY, maxY);
        }

        double toScreenX(double worldX) {
            return offsetX + worldX * cellSize;
        }

        double toScreenY(double worldY) {
            return offsetY - worldY * cellSize;
        }

        double toWorldX(double screenX) {
            return (screenX - offsetX) / cellSize;
        }

        double toWorldY(double screenY) {
            return (offsetY - screenY) / cellSize;
        }
    }
}
