package features.world.dungeonmap.ui.shared.render;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.DungeonRoom;
import features.world.dungeonmap.model.Point2i;
import javafx.geometry.Point2D;
import javafx.scene.canvas.Canvas;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.input.MouseEvent;
import javafx.scene.input.ScrollEvent;
import javafx.scene.layout.StackPane;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.function.BiConsumer;
import java.util.function.Consumer;

abstract class AbstractDungeonPane extends StackPane {

    protected final Canvas canvas = new Canvas();
    protected final DungeonCanvasCamera camera;
    protected DungeonLayout layout;
    protected DungeonLayoutRenderData renderData;
    protected Long selectedRoomId;
    protected Long activeRoomId;
    protected boolean editable;
    protected final Map<Long, Point2i> previewCenters = new HashMap<>();

    private Consumer<DungeonRoom> onRoomSelected = room -> { };
    private BiConsumer<DungeonRoom, Point2i> onRoomMoved = (room, center) -> { };
    private Consumer<Point2D> onViewportPanStarted = point -> { };
    private Consumer<Point2D> onViewportPanned = point -> { };
    private DungeonViewportZoomHandler onViewportZoomed = (screenX, screenY, factor) -> { };
    private PointerInteraction pointerInteraction = IdleInteraction.INSTANCE;

    protected AbstractDungeonPane(DungeonCanvasCamera camera) {
        this.camera = Objects.requireNonNull(camera, "camera");
        getChildren().add(canvas);
        widthProperty().addListener((obs, oldValue, newValue) -> resizeCanvas());
        heightProperty().addListener((obs, oldValue, newValue) -> resizeCanvas());
        canvas.addEventHandler(MouseEvent.MOUSE_PRESSED, this::handleMousePressed);
        canvas.addEventHandler(MouseEvent.MOUSE_DRAGGED, this::handleMouseDragged);
        canvas.addEventHandler(MouseEvent.MOUSE_RELEASED, this::handleMouseReleased);
        canvas.addEventHandler(ScrollEvent.SCROLL, this::handleScroll);
    }

    public final void setOnRoomSelected(Consumer<DungeonRoom> onRoomSelected) {
        this.onRoomSelected = Objects.requireNonNull(onRoomSelected, "onRoomSelected");
    }

    public final void setOnRoomMoved(BiConsumer<DungeonRoom, Point2i> onRoomMoved) {
        this.onRoomMoved = Objects.requireNonNull(onRoomMoved, "onRoomMoved");
    }

    public final void setEditable(boolean editable) {
        this.editable = editable;
    }

    public final void setOnViewportPanStarted(Consumer<Point2D> onViewportPanStarted) {
        this.onViewportPanStarted = Objects.requireNonNull(onViewportPanStarted, "onViewportPanStarted");
    }

    public final void setOnViewportPanned(Consumer<Point2D> onViewportPanned) {
        this.onViewportPanned = Objects.requireNonNull(onViewportPanned, "onViewportPanned");
    }

    public final void setOnViewportZoomed(DungeonViewportZoomHandler onViewportZoomed) {
        this.onViewportZoomed = Objects.requireNonNull(onViewportZoomed, "onViewportZoomed");
    }

    public final void showLayout(DungeonLayout layout, DungeonLayoutRenderData renderData, Long selectedRoomId, Long activeRoomId, boolean renderNow) {
        this.layout = layout;
        this.renderData = renderData;
        this.selectedRoomId = selectedRoomId;
        this.activeRoomId = activeRoomId;
        this.previewCenters.clear();
        if (renderNow) {
            render();
        }
    }

    public final void updateSelection(Long selectedRoomId, Long activeRoomId, boolean renderNow) {
        this.selectedRoomId = selectedRoomId;
        this.activeRoomId = activeRoomId;
        if (renderNow) {
            render();
        }
    }

    public final void refreshViewport() {
        render();
    }

    protected final Point2i previewCenter(DungeonRoom room) {
        return previewCenters.getOrDefault(room.roomId(), room.center());
    }

    protected final boolean isSelected(DungeonRoom room) {
        return room.roomId() != null && room.roomId().equals(selectedRoomId);
    }

    protected final boolean isActive(DungeonRoom room) {
        return room.roomId() != null && room.roomId().equals(activeRoomId);
    }

    protected abstract void renderContent(GraphicsContext gc);

    protected abstract Point2i worldPointAt(double screenX, double screenY);

    protected abstract DungeonRoom findRoomAt(double screenX, double screenY);

    private void resizeCanvas() {
        canvas.setWidth(Math.max(160, getWidth()));
        canvas.setHeight(Math.max(160, getHeight()));
        render();
    }

    private void render() {
        GraphicsContext gc = canvas.getGraphicsContext2D();
        DungeonCanvasTheme.paintBackground(gc, canvas.getWidth(), canvas.getHeight());
        if (layout == null) {
            return;
        }
        renderContent(gc);
    }

    private void handleMousePressed(MouseEvent event) {
        if (layout == null) {
            return;
        }
        Point2i world = worldPointAt(event.getX(), event.getY());
        DungeonRoom room = findRoomAt(event.getX(), event.getY());
        if (room != null) {
            onRoomSelected.accept(room);
            if (editable) {
                pointerInteraction = new DragInteraction(room, room.center(), world);
                return;
            }
        }
        pointerInteraction = new PanInteraction();
        onViewportPanStarted.accept(new Point2D(event.getX(), event.getY()));
    }

    private void handleMouseDragged(MouseEvent event) {
        if (pointerInteraction instanceof PanInteraction) {
            onViewportPanned.accept(new Point2D(event.getX(), event.getY()));
            return;
        }
        if (!editable || !(pointerInteraction instanceof DragInteraction dragInteraction)) {
            return;
        }
        Point2i world = worldPointAt(event.getX(), event.getY());
        Point2i delta = world.subtract(dragInteraction.anchorWorld());
        previewCenters.put(dragInteraction.room().roomId(), dragInteraction.originalCenter().add(delta));
        render();
    }

    private void handleMouseReleased(MouseEvent event) {
        if (pointerInteraction instanceof PanInteraction) {
            pointerInteraction = IdleInteraction.INSTANCE;
            return;
        }
        if (!editable || !(pointerInteraction instanceof DragInteraction dragInteraction)) {
            pointerInteraction = IdleInteraction.INSTANCE;
            return;
        }
        Point2i world = worldPointAt(event.getX(), event.getY());
        Point2i delta = world.subtract(dragInteraction.anchorWorld());
        Point2i newCenter = dragInteraction.originalCenter().add(delta);
        previewCenters.remove(dragInteraction.room().roomId());
        if (!newCenter.equals(dragInteraction.originalCenter())) {
            onRoomMoved.accept(dragInteraction.room(), newCenter);
        }
        pointerInteraction = IdleInteraction.INSTANCE;
        render();
    }

    private void handleScroll(ScrollEvent event) {
        double factor = event.getDeltaY() > 0 ? 1.1 : 0.9;
        onViewportZoomed.handle(event.getX(), event.getY(), factor);
    }

    private sealed interface PointerInteraction permits IdleInteraction, PanInteraction, DragInteraction { }

    private enum IdleInteraction implements PointerInteraction {
        INSTANCE
    }

    private static final class PanInteraction implements PointerInteraction { }

    private record DragInteraction(DungeonRoom room, Point2i originalCenter, Point2i anchorWorld) implements PointerInteraction { }
}
