package features.world.quarantine.dungeonmap.editor.workspace.corridor;

import features.world.quarantine.dungeonmap.editor.selection.CorridorDoorHandle;
import features.world.quarantine.dungeonmap.editor.selection.CorridorWaypointHandle;
import features.world.quarantine.dungeonmap.editor.workspace.preview.DungeonPaneRenderState;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonEditorTool;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;

import java.util.Objects;

public final class CorridorEditInteractionController {

    private final DungeonPaneRenderState renderState;
    private final DungeonPaneCorridorWorkspace corridorWorkspace;
    private Callbacks callbacks;
    private DragState dragState = IdleDragState.INSTANCE;
    private PressMode previewPressMode = PressMode.DEFAULT;

    public CorridorEditInteractionController(
            DungeonPaneRenderState renderState,
            DungeonPaneCorridorWorkspace corridorWorkspace,
            Callbacks callbacks
    ) {
        this.renderState = Objects.requireNonNull(renderState, "renderState");
        this.corridorWorkspace = Objects.requireNonNull(corridorWorkspace, "corridorWorkspace");
        this.callbacks = Objects.requireNonNull(callbacks, "callbacks");
    }

    public void bindCallbacks(Callbacks callbacks) {
        this.callbacks = Objects.requireNonNull(callbacks, "callbacks");
    }

    public void cancel() {
        corridorWorkspace.dragPreviewManager().clearCorridorDoorPreview();
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
        if (!renderState.editable() || renderState.editorTool() != DungeonEditorTool.SELECT || event.getButton() != MouseButton.PRIMARY) {
            return null;
        }
        PressMode pressMode = resolvePressMode(event);
        if (pressMode == PressMode.REMOVE_WAYPOINT) {
            CorridorWaypointHandle removeHandle = corridorWorkspace.corridorInteractionSupport().findCorridorWaypointRemoveHandleAt(event.getX(), event.getY());
            if (removeHandle != null) {
                return new RemoveWaypointPressHit(removeHandle);
            }
        }
        CorridorWaypointHandle waypointHandle = corridorWorkspace.corridorInteractionSupport().findCorridorWaypointHandleAt(event.getX(), event.getY());
        if (waypointHandle != null) {
            return new WaypointPressHit(waypointHandle);
        }
        CorridorDoorHandle doorHandle = corridorWorkspace.corridorInteractionSupport().findCorridorDoorHandleAt(event.getX(), event.getY());
        if (doorHandle != null) {
            return new DoorPressHit(doorHandle);
        }
        if (pressMode != PressMode.INSERT_WAYPOINT) {
            return null;
        }
        SegmentInsertHit segmentInsertHit = corridorWorkspace.corridorInteractionSupport().findCorridorSegmentInsertHitAt(event.getX(), event.getY());
        return segmentInsertHit == null ? null : new SegmentInsertPressHit(segmentInsertHit);
    }

    private PressMode resolvePressMode(MouseEvent event) {
        if (!renderState.editable() || renderState.editorTool() != DungeonEditorTool.SELECT) {
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
            corridorWorkspace.dragPreviewManager().clearCorridorDoorPreview();
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
        DoorDragPreview preview = corridorWorkspace.dragPreviewManager().corridorDoorDragPreviewAt(event.getX(), event.getY(), doorDragState.handle());
        return preview == null
                ? corridorWorkspace.dragPreviewManager().clearCorridorDoorPreview()
                : corridorWorkspace.dragPreviewManager().updateCorridorDoorPreview(doorDragState.handle(), preview);
    }

    public boolean handleDragRelease(MouseEvent event) {
        if (!(dragState instanceof DoorDragState doorDragState)) {
            corridorWorkspace.dragPreviewManager().clearCorridorDoorPreview();
            dragState = IdleDragState.INSTANCE;
            return false;
        }
        DoorDragPreview preview = corridorWorkspace.dragPreviewManager().corridorDoorDragPreviewAt(event.getX(), event.getY(), doorDragState.handle());
        corridorWorkspace.dragPreviewManager().clearCorridorDoorPreview();
        dragState = IdleDragState.INSTANCE;
        if (preview != null && preview.snapTarget() != null) {
            callbacks.onCorridorDoorMoved(doorDragState.handle(), preview.snapTarget());
        }
        return true;
    }

    public interface Callbacks {
        void onCorridorDoorSelected(CorridorDoorHandle handle);

        default void onCorridorDoorMoved(CorridorDoorHandle handle, DoorMoveTarget target) {
        }

        default void onCorridorWaypointSelected(CorridorWaypointHandle handle) {
        }

        default void onCorridorWaypointAdded(SegmentInsertHit hit) {
        }

        default void onCorridorWaypointRemoved(CorridorWaypointHandle handle) {
        }

        default void onCorridorWaypointMoved(CorridorWaypointHandle handle, Point2i cell) {
        }
    }

    public record DoorMoveTarget(
            long roomId,
            Point2i roomCell,
            features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster.EdgeDirection direction
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
