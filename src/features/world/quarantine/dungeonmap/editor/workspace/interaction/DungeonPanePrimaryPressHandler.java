package features.world.quarantine.dungeonmap.editor.workspace.interaction;

import features.world.quarantine.dungeonmap.editor.workspace.interaction.DungeonPanePointerController.DungeonPanePointerHit;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.CorridorRoomRemoval;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonEditorTool;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonViewMode;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.CorridorDoorHit;
import features.world.quarantine.dungeonmap.editor.workspace.preview.DungeonPanePreviewModel;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridorEndpoint;
import java.util.Set;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;

final class DungeonPanePrimaryPressHandler {

    private final DungeonPanePointerProjection projection;
    private final DungeonPanePointerController controller;
    private final DungeonPanePreviewModel previewModel;

    DungeonPanePrimaryPressHandler(
            DungeonPanePointerProjection projection,
            DungeonPanePointerController controller,
            DungeonPanePreviewModel previewModel
    ) {
        this.projection = projection;
        this.controller = controller;
        this.previewModel = previewModel;
    }

    boolean handle(MouseEvent event, DungeonPanePointerHit hit) {
        return handleRoomToolPress(event, hit)
                || handleCorridorToolPress(event, hit)
                || handleRoomDragPress(event, hit)
                || handleSelectionPress(event, hit)
                || handlePassiveSelection(hit);
    }

    private boolean handleRoomToolPress(MouseEvent event, DungeonPanePointerHit hit) {
        if (!controller.editable() || event.getButton() != MouseButton.PRIMARY) {
            return false;
        }
        if ((controller.editorTool().isWallTool() || controller.editorTool().isDoorTool())
                && controller.viewMode() == DungeonViewMode.GRID) {
            var edgeRef = projection.findClusterEdgeAt(event.getX(), event.getY());
            if (edgeRef == null) {
                return false;
            }
            if (controller.editorTool().isWallTool()) {
                controller.wallPathController().handlePrimaryPress(event.getX(), event.getY());
            } else if (controller.editorTool() == DungeonEditorTool.CLUSTER_DOOR_DELETE) {
                controller.events().onClusterDoorDeleted(Set.of(edgeRef));
            } else {
                controller.events().onClusterDoorPainted(Set.of(edgeRef));
            }
            return true;
        }
        if (controller.editorTool() != DungeonEditorTool.ROOM_PAINT && controller.editorTool() != DungeonEditorTool.ROOM_DELETE) {
            return false;
        }
        if (controller.viewMode() == DungeonViewMode.GRID && controller.editorTool() == DungeonEditorTool.ROOM_PAINT) {
            return handleGridRoomPaint(hit);
        }
        if (controller.viewMode() == DungeonViewMode.GRID && controller.editorTool() == DungeonEditorTool.ROOM_DELETE) {
            return handleGridRoomDelete(hit);
        }
        if (controller.viewMode() == DungeonViewMode.GRAPH) {
            return handleGraphRoomPress(hit);
        }
        return false;
    }

    private boolean handleGridRoomPaint(DungeonPanePointerHit hit) {
        controller.interactionState().setPointerInteraction(new DungeonPaneInteractionState.PaintInteraction(hit.world()));
        previewModel.preview().beginPaint(hit.world());
        return true;
    }

    private boolean handleGridRoomDelete(DungeonPanePointerHit hit) {
        controller.interactionState().setPointerInteraction(new DungeonPaneInteractionState.PaintInteraction(hit.world()));
        previewModel.preview().beginPaint(hit.world());
        return true;
    }

    private boolean handleGraphRoomPress(DungeonPanePointerHit hit) {
        if (controller.editorTool() == DungeonEditorTool.ROOM_PAINT
                && hit.cluster() == null
                && hit.room() == null
                && projection.canCreateGraphRoomAt(hit.world())) {
            controller.interactionState().setPointerInteraction(new DungeonPaneInteractionState.GraphCreateInteraction(hit.world()));
            return true;
        }
        if (controller.editorTool() == DungeonEditorTool.ROOM_DELETE && hit.cluster() != null) {
            controller.interactionState().setPointerInteraction(new DungeonPaneInteractionState.GraphDeleteInteraction(hit.cluster()));
            return true;
        }
        return false;
    }

    private boolean handleCorridorToolPress(MouseEvent event, DungeonPanePointerHit hit) {
        if (!controller.editable() || event.getButton() != MouseButton.PRIMARY) {
            return false;
        }
        if (controller.editorTool() != DungeonEditorTool.CORRIDOR_CREATE && controller.editorTool() != DungeonEditorTool.CORRIDOR_DELETE) {
            return false;
        }
        if (controller.editorTool() == DungeonEditorTool.CORRIDOR_CREATE) {
            DungeonCorridorEndpoint endpoint = projection.hitTests().corridorEndpointLocationAt(new features.world.quarantine.dungeonmap.foundation.geometry.ScreenPoint(event.getX(), event.getY()), hit.room(), hit.corridor());
            if (endpoint != null) {
                controller.events().onCorridorEndpointSelected(endpoint);
                return true;
            }
            if (hit.corridor() != null) {
                controller.events().onCorridorEndpointSelected(DungeonCorridorEndpoint.corridor(hit.corridor().corridorId()));
                return true;
            }
            return false;
        }
        CorridorDoorHit doorHit = hit.corridorDoorHit();
        if (doorHit != null) {
            if (!doorHit.isEmpty())
                controller.events().onCorridorRoomRemoved(new CorridorRoomRemoval(doorHit.primaryCorridorId(), doorHit.roomId()));
            return true;
        }
        if (hit.corridor() != null) {
            controller.events().onCorridorDeleted(hit.corridor());
            return true;
        }
        return false;
    }

    private boolean handleRoomDragPress(MouseEvent event, DungeonPanePointerHit hit) {
        if (!(controller.editable() && hit.cluster() != null && isRoomDragButton(event.getButton(), controller.editorTool()))) {
            return false;
        }
        controller.events().onClusterSelected(hit.cluster());
        controller.interactionState().setPointerInteraction(new DungeonPaneInteractionState.DragInteraction(
                hit.cluster(),
                hit.cluster().center(),
                projection.worldX(event.getX()),
                projection.worldY(event.getY())));
        return true;
    }

    private boolean handleSelectionPress(MouseEvent event, DungeonPanePointerHit hit) {
        if (!(controller.editable()
                && event.getButton() == MouseButton.PRIMARY
                && controller.editorTool() == DungeonEditorTool.SELECT
                && controller.viewMode() == DungeonViewMode.GRID
                && hit.corridor() == null
                && hit.cluster() == null
                && hit.room() == null)) {
            return false;
        }
        controller.interactionState().setPointerInteraction(new DungeonPaneInteractionState.SelectionInteraction(hit.world()));
        previewModel.preview().beginSelection(hit.world());
        return true;
    }

    private boolean handlePassiveSelection(DungeonPanePointerHit hit) {
        if (hit.corridor() != null) {
            controller.events().onCorridorSelected(hit.corridor());
            return true;
        }
        if (hit.cluster() != null) {
            controller.events().onClusterSelected(hit.cluster());
            return true;
        }
        if (hit.room() != null) {
            controller.events().onRoomSelected(hit.room());
            return true;
        }
        controller.interactionState().setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
        return true;
    }

    private static boolean isRoomDragButton(MouseButton button, DungeonEditorTool tool) {
        if (button == MouseButton.MIDDLE) {
            return true;
        }
        return button == MouseButton.PRIMARY && tool == DungeonEditorTool.SELECT;
    }
}
