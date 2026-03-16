package features.world.dungeonmap.ui.workspace.render;

import features.world.dungeonmap.model.Point2i;
import features.world.dungeonmap.ui.workspace.DungeonEditorTool;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;

import java.util.Objects;
import java.util.function.BiConsumer;
import java.util.function.Consumer;

public final class CorridorEditInteractionController {

    private final Host host;
    private DragState dragState = IdleDragState.INSTANCE;
    private PressMode previewPressMode = PressMode.DEFAULT;
    private Consumer<DoorHandle> onCorridorDoorSelected = handle -> { };
    private BiConsumer<DoorHandle, DoorMoveTarget> onCorridorDoorMoved = (handle, target) -> { };
    private Consumer<WaypointHandle> onCorridorWaypointSelected = handle -> { };
    private Consumer<SegmentInsertHit> onCorridorWaypointAdded = hit -> { };
    private Consumer<WaypointHandle> onCorridorWaypointRemoved = handle -> { };
    private BiConsumer<WaypointHandle, Point2i> onCorridorWaypointMoved = (handle, cell) -> { };

    CorridorEditInteractionController(Host host) {
        this.host = Objects.requireNonNull(host, "host");
    }

    void setOnCorridorDoorSelected(Consumer<DoorHandle> onCorridorDoorSelected) {
        this.onCorridorDoorSelected = Objects.requireNonNull(onCorridorDoorSelected, "onCorridorDoorSelected");
    }

    void setOnCorridorDoorMoved(BiConsumer<DoorHandle, DoorMoveTarget> onCorridorDoorMoved) {
        this.onCorridorDoorMoved = Objects.requireNonNull(onCorridorDoorMoved, "onCorridorDoorMoved");
    }

    void setOnCorridorWaypointSelected(Consumer<WaypointHandle> onCorridorWaypointSelected) {
        this.onCorridorWaypointSelected = Objects.requireNonNull(onCorridorWaypointSelected, "onCorridorWaypointSelected");
    }

    void setOnCorridorWaypointAdded(Consumer<SegmentInsertHit> onCorridorWaypointAdded) {
        this.onCorridorWaypointAdded = Objects.requireNonNull(onCorridorWaypointAdded, "onCorridorWaypointAdded");
    }

    void setOnCorridorWaypointRemoved(Consumer<WaypointHandle> onCorridorWaypointRemoved) {
        this.onCorridorWaypointRemoved = Objects.requireNonNull(onCorridorWaypointRemoved, "onCorridorWaypointRemoved");
    }

    void setOnCorridorWaypointMoved(BiConsumer<WaypointHandle, Point2i> onCorridorWaypointMoved) {
        this.onCorridorWaypointMoved = Objects.requireNonNull(onCorridorWaypointMoved, "onCorridorWaypointMoved");
    }

    void cancel() {
        dragState = IdleDragState.INSTANCE;
    }

    boolean updatePreviewPressMode(MouseEvent event) {
        PressMode nextMode = resolvePressMode(event);
        if (previewPressMode == nextMode) {
            return false;
        }
        previewPressMode = nextMode;
        return true;
    }

    void clearPreviewPressMode() {
        previewPressMode = PressMode.DEFAULT;
    }

    PressMode previewPressMode() {
        return previewPressMode;
    }

    PressHit hitTest(MouseEvent event) {
        if (!host.editable() || host.editorTool() != DungeonEditorTool.SELECT || event.getButton() != MouseButton.PRIMARY) {
            return null;
        }
        PressMode pressMode = resolvePressMode(event);
        if (pressMode == PressMode.REMOVE_WAYPOINT) {
            WaypointHandle removeHandle = host.findCorridorWaypointRemoveHandleAt(event.getX(), event.getY());
            if (removeHandle != null) {
                return new RemoveWaypointPressHit(removeHandle);
            }
        }
        WaypointHandle waypointHandle = host.findCorridorWaypointHandleAt(event.getX(), event.getY());
        if (waypointHandle != null) {
            return new WaypointPressHit(waypointHandle);
        }
        DoorHandle doorHandle = host.findCorridorDoorHandleAt(event.getX(), event.getY());
        if (doorHandle != null) {
            return new DoorPressHit(doorHandle);
        }
        if (pressMode != PressMode.INSERT_WAYPOINT) {
            return null;
        }
        SegmentInsertHit segmentInsertHit = host.findCorridorSegmentInsertHitAt(event.getX(), event.getY());
        return segmentInsertHit == null ? null : new SegmentInsertPressHit(segmentInsertHit);
    }

    private PressMode resolvePressMode(MouseEvent event) {
        if (!host.editable() || host.editorTool() != DungeonEditorTool.SELECT) {
            return PressMode.DEFAULT;
        }
        if (event.isShortcutDown()) {
            return PressMode.REMOVE_WAYPOINT;
        }
        if (event.isShiftDown()) {
            return PressMode.INSERT_WAYPOINT;
        }
        return PressMode.DEFAULT;
    }

    boolean handlePress(PressHit hit) {
        if (hit == null) {
            return false;
        }
        if (hit instanceof RemoveWaypointPressHit removeWaypointHit) {
            dragState = IdleDragState.INSTANCE;
            onCorridorWaypointRemoved.accept(removeWaypointHit.handle());
            return true;
        }
        if (hit instanceof WaypointPressHit waypointHit) {
            onCorridorWaypointSelected.accept(waypointHit.handle());
            dragState = new WaypointDragState(waypointHit.handle());
            return true;
        }
        if (hit instanceof DoorPressHit doorHit) {
            onCorridorDoorSelected.accept(doorHit.handle());
            // A handle hit starts the drag. The drop target is validated on release.
            dragState = new DoorDragState(doorHit.handle());
            return true;
        }
        if (hit instanceof SegmentInsertPressHit segmentInsertActionHit) {
            onCorridorWaypointAdded.accept(segmentInsertActionHit.hit());
            return true;
        }
        return false;
    }

    boolean handleEditableRelease(Point2i world) {
        if (!(dragState instanceof WaypointDragState waypointDragState)) {
            return false;
        }
        dragState = IdleDragState.INSTANCE;
        onCorridorWaypointMoved.accept(waypointDragState.handle(), world);
        return true;
    }

    boolean handleDragRelease(MouseEvent event) {
        if (!(dragState instanceof DoorDragState doorDragState)) {
            dragState = IdleDragState.INSTANCE;
            return false;
        }
        dragState = IdleDragState.INSTANCE;
        DoorMoveTarget target = host.corridorDoorMoveTargetAt(event.getX(), event.getY(), doorDragState.handle());
        if (target != null) {
            onCorridorDoorMoved.accept(doorDragState.handle(), target);
        }
        return true;
    }

    interface Host {
        boolean editable();
        DungeonEditorTool editorTool();
        DoorHandle findCorridorDoorHandleAt(double screenX, double screenY);
        DoorMoveTarget corridorDoorMoveTargetAt(double screenX, double screenY, DoorHandle handle);
        WaypointHandle findCorridorWaypointHandleAt(double screenX, double screenY);
        WaypointHandle findCorridorWaypointRemoveHandleAt(double screenX, double screenY);
        SegmentInsertHit findCorridorSegmentInsertHitAt(double screenX, double screenY);
    }

    public record DoorHandle(
            long corridorId,
            long roomId
    ) {
    }

    public record DoorMoveTarget(
            Point2i roomCell,
            features.world.dungeonmap.model.DungeonRoomCluster.EdgeDirection direction
    ) {
    }

    public record WaypointHandle(
            long corridorId,
            int waypointIndex
    ) {
    }

    public record SegmentInsertHit(
            long corridorId,
            int insertIndex,
            Point2i cell
    ) {
    }

    sealed interface PressHit permits DoorPressHit, WaypointPressHit, RemoveWaypointPressHit, SegmentInsertPressHit {
    }

    enum PressMode {
        DEFAULT,
        INSERT_WAYPOINT,
        REMOVE_WAYPOINT
    }

    record DoorPressHit(DoorHandle handle) implements PressHit {
    }

    record WaypointPressHit(WaypointHandle handle) implements PressHit {
    }

    record RemoveWaypointPressHit(WaypointHandle handle) implements PressHit {
    }

    record SegmentInsertPressHit(SegmentInsertHit hit) implements PressHit {
    }

    private sealed interface DragState permits IdleDragState, DoorDragState, WaypointDragState {
    }

    private enum IdleDragState implements DragState {
        INSTANCE
    }

    private record DoorDragState(DoorHandle handle) implements DragState {
    }

    private record WaypointDragState(WaypointHandle handle) implements DragState {
    }
}
