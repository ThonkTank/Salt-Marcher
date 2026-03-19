package features.world.quarantine.dungeonmap.editor.workspace.interaction;

import features.world.quarantine.dungeonmap.editor.workspace.interaction.DungeonPanePointerController.DungeonPanePointerHit;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.DungeonPaneCorridorWorkspace;
import features.world.quarantine.dungeonmap.editor.workspace.preview.DungeonPanePreviewModel;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import javafx.scene.input.MouseEvent;

final class DungeonPaneReleaseHandler {

    private final DungeonPanePointerController controller;
    private final DungeonPanePreviewModel previewModel;
    private final DungeonPaneCorridorWorkspace corridorWorkspace;

    DungeonPaneReleaseHandler(
            DungeonPanePointerController controller,
            DungeonPanePreviewModel previewModel,
            DungeonPaneCorridorWorkspace corridorWorkspace
    ) {
        this.controller = controller;
        this.previewModel = previewModel;
        this.corridorWorkspace = corridorWorkspace;
    }

    boolean handle(MouseEvent event, DungeonPanePointerHit hit) {
        if (handleEditableRelease(hit.world())) {
            return true;
        }
        if (!controller.editable()) {
            corridorWorkspace.clearCorridorDoorPreview();
            controller.interactionState().setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
            return true;
        }
        if (controller.interactionState().pointerInteraction() instanceof DungeonPaneInteractionState.DragInteraction dragInteraction) {
            controller.interactionState().setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
            previewModel.preview().commitDrag(dragInteraction);
            return true;
        }
        if (controller.corridorController().handleDragRelease(event)) {
            controller.interactionState().setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
            controller.requestRender();
            return true;
        }
        controller.interactionState().setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
        return false;
    }

    private boolean handleEditableRelease(Point2i world) {
        if (controller.editable()) {
            switch (controller.interactionState().pointerInteraction()) {
                case DungeonPaneInteractionState.SelectionInteraction s -> {
                    controller.interactionState().setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
                    previewModel.preview().commitSelection(s.anchorWorld(), world);
                    return true;
                }
                case DungeonPaneInteractionState.PaintInteraction p -> {
                    previewModel.preview().commitPaint(world);
                    controller.interactionState().setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
                    return true;
                }
                case DungeonPaneInteractionState.GraphCreateInteraction g -> {
                    controller.interactionState().setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
                    controller.events().onGraphRoomRequested(g.world());
                    return true;
                }
                case DungeonPaneInteractionState.GraphDeleteInteraction g -> {
                    controller.interactionState().setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
                    controller.events().onGraphClusterDeleted(g.cluster());
                    return true;
                }
                default -> {}
            }
        }
        if (controller.corridorController().handleEditableRelease(world)) {
            controller.interactionState().setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
            return true;
        }
        return false;
    }
}
