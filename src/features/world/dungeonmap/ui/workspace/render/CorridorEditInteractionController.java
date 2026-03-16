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
    private Consumer<DoorHandle> onCorridorDoorSelected = handle -> { };
    private BiConsumer<DoorHandle, DoorMoveTarget> onCorridorDoorMoved = (handle, target) -> { };
    private Consumer<WaypointHandle> onCorridorWaypointSelected = handle -> { };
    private Consumer<SegmentInsertHit> onCorridorWaypointAdded = hit -> { };
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

    void setOnCorridorWaypointMoved(BiConsumer<WaypointHandle, Point2i> onCorridorWaypointMoved) {
        this.onCorridorWaypointMoved = Objects.requireNonNull(onCorridorWaypointMoved, "onCorridorWaypointMoved");
    }

    void cancel() {
        dragState = IdleDragState.INSTANCE;
    }

    boolean handlePress(MouseEvent event) {
        if (!host.editable() || event.getButton() != MouseButton.PRIMARY || host.editorTool() != DungeonEditorTool.SELECT) {
            return false;
        }
        WaypointHandle waypointHandle = host.findCorridorWaypointHandleAt(event.getX(), event.getY());
        if (waypointHandle != null) {
            onCorridorWaypointSelected.accept(waypointHandle);
            dragState = new WaypointDragState(waypointHandle);
            return true;
        }
        DoorHandle doorHandle = host.findCorridorDoorHandleAt(event.getX(), event.getY());
        if (doorHandle != null) {
            onCorridorDoorSelected.accept(doorHandle);
            if (host.corridorDoorMoveTargetAt(event.getX(), event.getY(), doorHandle) != null) {
                dragState = new DoorDragState(doorHandle);
            }
            return true;
        }
        SegmentInsertHit segmentInsertHit = host.findCorridorSegmentInsertHitAt(event.getX(), event.getY());
        if (segmentInsertHit != null) {
            onCorridorWaypointAdded.accept(segmentInsertHit);
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
