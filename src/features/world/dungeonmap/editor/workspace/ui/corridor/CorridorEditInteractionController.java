package features.world.dungeonmap.editor.workspace.ui.corridor;

import features.world.dungeonmap.editor.session.application.CorridorDoorHandle;
import features.world.dungeonmap.editor.session.application.CorridorWaypointHandle;
import features.world.dungeonmap.foundation.geometry.Point2i;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonEditorTool;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonPaneReadContext;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;

import java.util.Objects;

public final class CorridorEditInteractionController {

    private final Host host;
    private final Callbacks callbacks;
    private DragState dragState = IdleDragState.INSTANCE;
    private PressMode previewPressMode = PressMode.DEFAULT;

    public CorridorEditInteractionController(Host host, Callbacks callbacks) {
        this.host = Objects.requireNonNull(host, "host");
        this.callbacks = Objects.requireNonNull(callbacks, "callbacks");
    }

    public void cancel() {
        host.clearCorridorDoorPreview();
        dragState = IdleDragState.INSTANCE;
    }

    public boolean updatePreviewPressMode(MouseEvent event) {
        PressMode nextMode = resolvePressMode(event);
        if (previewPressMode == nextMode) {
            return false;
        }
        previewPressMode = nextMode;
        return true;
    }

    public void clearPreviewPressMode() {
        previewPressMode = PressMode.DEFAULT;
    }

    public PressMode previewPressMode() {
        return previewPressMode;
    }

    public PressHit hitTest(MouseEvent event) {
        if (!host.editable() || host.editorTool() != DungeonEditorTool.SELECT || event.getButton() != MouseButton.PRIMARY) {
            return null;
        }
        PressMode pressMode = resolvePressMode(event);
        if (pressMode == PressMode.REMOVE_WAYPOINT) {
            CorridorWaypointHandle removeHandle = host.findCorridorWaypointRemoveHandleAt(event.getX(), event.getY());
            if (removeHandle != null) {
                return new RemoveWaypointPressHit(removeHandle);
            }
        }
        CorridorWaypointHandle waypointHandle = host.findCorridorWaypointHandleAt(event.getX(), event.getY());
        if (waypointHandle != null) {
            return new WaypointPressHit(waypointHandle);
        }
        CorridorDoorHandle doorHandle = host.findCorridorDoorHandleAt(event.getX(), event.getY());
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

    public boolean handlePress(PressHit hit) {
        if (hit == null) {
            return false;
        }
        if (hit instanceof RemoveWaypointPressHit removeWaypointHit) {
            dragState = IdleDragState.INSTANCE;
            callbacks.onCorridorWaypointRemoved(removeWaypointHit.handle());
            return true;
        }
        if (hit instanceof WaypointPressHit waypointHit) {
            callbacks.onCorridorWaypointSelected(waypointHit.handle());
            dragState = new WaypointDragState(waypointHit.handle());
            return true;
        }
        if (hit instanceof DoorPressHit doorHit) {
            callbacks.onCorridorDoorSelected(doorHit.handle());
            host.clearCorridorDoorPreview();
            // A handle hit starts the drag. The drop target is validated on release.
            dragState = new DoorDragState(doorHit.handle());
            return true;
        }
        if (hit instanceof SegmentInsertPressHit segmentInsertActionHit) {
            callbacks.onCorridorWaypointAdded(segmentInsertActionHit.hit());
            return true;
        }
        return false;
    }

    public boolean handleEditableRelease(Point2i world) {
        if (!(dragState instanceof WaypointDragState waypointDragState)) {
            return false;
        }
        dragState = IdleDragState.INSTANCE;
        callbacks.onCorridorWaypointMoved(waypointDragState.handle(), world);
        return true;
    }

    public boolean handleDrag(MouseEvent event) {
        if (!(dragState instanceof DoorDragState doorDragState)) {
            return false;
        }
        DoorDragPreview preview = host.corridorDoorDragPreviewAt(event.getX(), event.getY(), doorDragState.handle());
        return preview == null
                ? host.clearCorridorDoorPreview()
                : host.updateCorridorDoorPreview(doorDragState.handle(), preview);
    }

    public boolean handleDragRelease(MouseEvent event) {
        if (!(dragState instanceof DoorDragState doorDragState)) {
            host.clearCorridorDoorPreview();
            dragState = IdleDragState.INSTANCE;
            return false;
        }
        DoorDragPreview preview = host.corridorDoorDragPreviewAt(event.getX(), event.getY(), doorDragState.handle());
        host.clearCorridorDoorPreview();
        dragState = IdleDragState.INSTANCE;
        if (preview != null && preview.snapTarget() != null) {
            callbacks.onCorridorDoorMoved(doorDragState.handle(), preview.snapTarget());
        }
        return true;
    }

    public interface Callbacks {
        void onCorridorDoorSelected(CorridorDoorHandle handle);
        void onCorridorDoorMoved(CorridorDoorHandle handle, DoorMoveTarget target);
        void onCorridorWaypointSelected(CorridorWaypointHandle handle);
        void onCorridorWaypointAdded(SegmentInsertHit hit);
        void onCorridorWaypointRemoved(CorridorWaypointHandle handle);
        void onCorridorWaypointMoved(CorridorWaypointHandle handle, Point2i cell);
    }

    public interface Host extends DungeonPaneReadContext {
        boolean editable();
        DungeonEditorTool editorTool();
        CorridorDoorHandle findCorridorDoorHandleAt(double screenX, double screenY);
        DoorDragPreview corridorDoorDragPreviewAt(double screenX, double screenY, CorridorDoorHandle handle);
        boolean updateCorridorDoorPreview(CorridorDoorHandle handle, DoorDragPreview preview);
        boolean clearCorridorDoorPreview();
        CorridorWaypointHandle findCorridorWaypointHandleAt(double screenX, double screenY);
        CorridorWaypointHandle findCorridorWaypointRemoveHandleAt(double screenX, double screenY);
        SegmentInsertHit findCorridorSegmentInsertHitAt(double screenX, double screenY);
    }

    public record DoorMoveTarget(
            long roomId,
            Point2i roomCell,
            features.world.dungeonmap.rooms.model.DungeonRoomCluster.EdgeDirection direction
    ) {
    }

    public record DoorDragPreview(
            DoorMoveTarget snapTarget,
            DoorPreviewSegment previewSegment
    ) {
    }

    public record DoorPreviewSegment(
            double startWorldX,
            double startWorldY,
            double endWorldX,
            double endWorldY,
            double centerWorldX,
            double centerWorldY
    ) {
    }


    public record SegmentInsertHit(
            long corridorId,
            int insertIndex,
            Point2i cell
    ) {
    }

    public sealed interface PressHit permits DoorPressHit, WaypointPressHit, RemoveWaypointPressHit, SegmentInsertPressHit {
    }

    public enum PressMode {
        DEFAULT,
        INSERT_WAYPOINT,
        REMOVE_WAYPOINT
    }

    record DoorPressHit(CorridorDoorHandle handle) implements PressHit {
    }

    record WaypointPressHit(CorridorWaypointHandle handle) implements PressHit {
    }

    record RemoveWaypointPressHit(CorridorWaypointHandle handle) implements PressHit {
    }

    record SegmentInsertPressHit(SegmentInsertHit hit) implements PressHit {
    }

    private sealed interface DragState permits IdleDragState, DoorDragState, WaypointDragState {
    }

    private enum IdleDragState implements DragState {
        INSTANCE
    }

    private record DoorDragState(CorridorDoorHandle handle) implements DragState {
    }

    private record WaypointDragState(CorridorWaypointHandle handle) implements DragState {
    }
}
