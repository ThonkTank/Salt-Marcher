package features.world.dungeonmap.ui.shared;

import features.world.dungeonmap.model.DungeonCorridor;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.Point2i;
import javafx.scene.canvas.Canvas;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.input.MouseEvent;
import javafx.scene.layout.StackPane;
import javafx.scene.paint.Color;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.function.BiConsumer;
import java.util.function.Consumer;

public final class DungeonGraphPane extends StackPane {

    private final Canvas canvas = new Canvas();
    private DungeonLayout layout;
    private Long selectedRoomId;
    private Long activeRoomId;
    private boolean editable;
    private Consumer<DungeonRoom> onRoomSelected = room -> { };
    private BiConsumer<DungeonRoom, Point2i> onRoomMoved = (room, center) -> { };
    private DungeonRoom draggingRoom;
    private Point2i dragOriginalCenter;
    private Point2i dragAnchorWorld;
    private final Map<Long, Point2i> previewCenters = new HashMap<>();

    public DungeonGraphPane() {
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
        gc.setFill(Color.web("#fbf8f3"));
        gc.fillRect(0, 0, canvas.getWidth(), canvas.getHeight());
        if (layout == null) {
            return;
        }
        DungeonGridPane.Viewport viewport = DungeonGridPane.Viewport.forLayout(layout.rooms(), canvas.getWidth(), canvas.getHeight(), 42, true);
        gc.setStroke(Color.web("#a3a3a3"));
        gc.setLineWidth(3);
        Map<Long, DungeonRoom> roomsById = new HashMap<>();
        for (DungeonRoom room : layout.rooms()) {
            roomsById.put(room.roomId(), room);
        }
        for (DungeonCorridor corridor : layout.corridors()) {
            DungeonRoom from = roomsById.get(corridor.fromRoomId());
            DungeonRoom to = roomsById.get(corridor.toRoomId());
            if (from == null || to == null) {
                continue;
            }
            Point2i fromCenter = previewCenters.getOrDefault(from.roomId(), from.center());
            Point2i toCenter = previewCenters.getOrDefault(to.roomId(), to.center());
            gc.strokeLine(
                    viewport.toScreenX(fromCenter.x() + 0.5),
                    viewport.toScreenY(fromCenter.y() + 0.5),
                    viewport.toScreenX(toCenter.x() + 0.5),
                    viewport.toScreenY(toCenter.y() + 0.5));
        }
        for (DungeonRoom room : layout.rooms()) {
            Point2i center = previewCenters.getOrDefault(room.roomId(), room.center());
            double screenX = viewport.toScreenX(center.x() + 0.5);
            double screenY = viewport.toScreenY(center.y() + 0.5);
            boolean active = room.roomId() != null && room.roomId().equals(activeRoomId);
            boolean selected = room.roomId() != null && room.roomId().equals(selectedRoomId);
            gc.setFill(active ? Color.web("#bfdcab") : Color.web("#c8b184"));
            gc.fillOval(screenX - 24, screenY - 24, 48, 48);
            gc.setStroke(selected ? Color.web("#b65427") : Color.web("#4d3926"));
            gc.setLineWidth(selected ? 3 : 2);
            gc.strokeOval(screenX - 24, screenY - 24, 48, 48);
            gc.setFill(Color.web("#2d241a"));
            gc.fillText(room.name(), screenX - 16, screenY + 4);
        }
    }

    private void handleMousePressed(MouseEvent event) {
        if (layout == null) {
            return;
        }
        Point2i world = worldAt(event.getX(), event.getY());
        DungeonRoom room = findRoomNear(world);
        if (room != null) {
            onRoomSelected.accept(room);
            if (editable) {
                draggingRoom = room;
                dragOriginalCenter = room.center();
                dragAnchorWorld = world;
            }
        }
    }

    private void handleMouseDragged(MouseEvent event) {
        if (!editable || draggingRoom == null || dragOriginalCenter == null || dragAnchorWorld == null) {
            return;
        }
        Point2i world = worldAt(event.getX(), event.getY());
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
        Point2i world = worldAt(event.getX(), event.getY());
        Point2i delta = world.subtract(dragAnchorWorld);
        Point2i newCenter = dragOriginalCenter.add(delta);
        previewCenters.remove(draggingRoom.roomId());
        onRoomMoved.accept(draggingRoom, newCenter);
        draggingRoom = null;
        dragOriginalCenter = null;
        dragAnchorWorld = null;
        render();
    }

    private Point2i worldAt(double screenX, double screenY) {
        DungeonGridPane.Viewport viewport = DungeonGridPane.Viewport.forLayout(layout.rooms(), canvas.getWidth(), canvas.getHeight(), 42, true);
        int x = (int) Math.round(viewport.toWorldX(screenX));
        int y = (int) Math.round(viewport.toWorldY(screenY));
        return new Point2i(x, y);
    }

    private DungeonRoom findRoomNear(Point2i point) {
        DungeonRoom closest = null;
        int bestDistance = Integer.MAX_VALUE;
        for (DungeonRoom room : layout.rooms()) {
            Point2i center = previewCenters.getOrDefault(room.roomId(), room.center());
            int distance = Math.abs(center.x() - point.x()) + Math.abs(center.y() - point.y());
            if (distance < bestDistance && distance <= 2) {
                bestDistance = distance;
                closest = room;
            }
        }
        return closest;
    }
}
