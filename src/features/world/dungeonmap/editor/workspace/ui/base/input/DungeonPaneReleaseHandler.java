package features.world.dungeonmap.editor.workspace.ui.base.input;
import features.world.dungeonmap.foundation.geometry.Point2i;

import features.world.dungeonmap.editor.workspace.ui.base.input.DungeonPaneRenderContext;
import javafx.scene.input.MouseEvent;

final class DungeonPaneReleaseHandler {

    private final DungeonPaneInputContext interaction;
    private final DungeonPaneRenderContext render;

    DungeonPaneReleaseHandler(DungeonPaneInputContext interaction, DungeonPaneRenderContext render) {
        this.interaction = interaction;
        this.render = render;
    }

    boolean handle(MouseEvent event, DungeonPanePointerHit hit) {
        if (handleEditableRelease(hit.world())) {
            return true;
        }
        if (!interaction.editable()) {
            render.clearCorridorDoorPreview();
            interaction.interactionState().setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
            return true;
        }
        if (interaction.interactionState().pointerInteraction() instanceof DungeonPaneInteractionState.DragInteraction dragInteraction) {
            interaction.interactionState().setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
            render.commitDrag(dragInteraction);
            return true;
        }
        if (interaction.controller().handleDragRelease(event)) {
            interaction.interactionState().setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
            render.requestRender();
            return true;
        }
        interaction.interactionState().setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
        return false;
    }

    private boolean handleEditableRelease(features.world.dungeonmap.foundation.geometry.Point2i world) {
        if (interaction.editable()) {
            switch (interaction.interactionState().pointerInteraction()) {
                case DungeonPaneInteractionState.SelectionInteraction s -> {
                    interaction.interactionState().setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
                    render.commitSelection(s.anchorWorld(), world);
                    return true;
                }
                case DungeonPaneInteractionState.PaintInteraction p -> {
                    render.commitPaint(world);
                    interaction.interactionState().setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
                    return true;
                }
                case DungeonPaneInteractionState.GraphCreateInteraction g -> {
                    interaction.interactionState().setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
                    interaction.events().onGraphRoomRequested(g.world());
                    return true;
                }
                case DungeonPaneInteractionState.GraphDeleteInteraction g -> {
                    interaction.interactionState().setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
                    interaction.events().onGraphClusterDeleted(g.cluster());
                    return true;
                }
                default -> {}
            }
        }
        if (interaction.controller().handleEditableRelease(world)) {
            interaction.interactionState().setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
            return true;
        }
        return false;
    }
}
