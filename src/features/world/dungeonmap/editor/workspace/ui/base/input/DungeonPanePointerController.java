package features.world.dungeonmap.editor.workspace.ui.base.input;

import features.world.dungeonmap.foundation.geometry.Point2i;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonEditorTool;
import features.world.dungeonmap.editor.workspace.ui.base.input.DungeonPaneRenderContext;
import features.world.dungeonmap.editor.session.application.CorridorDoorHandle;
import features.world.dungeonmap.editor.workspace.ui.corridor.CorridorEditInteractionController;
import javafx.geometry.Point2D;
import javafx.scene.input.KeyEvent;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;
import javafx.scene.input.ScrollEvent;

public final class DungeonPanePointerController {

    private final DungeonPanePointerProjection projection;
    private final DungeonPaneInputContext interaction;
    private final DungeonPaneRenderContext render;
    private final DungeonPanePrimaryPressHandler primaryPressHandler;
    private final DungeonPaneReleaseHandler releaseHandler;

    public DungeonPanePointerController(
            DungeonPanePointerProjection projection,
            DungeonPaneGridPointerProjection gridProjection,
            DungeonPaneGraphCreationProjection graphCreationProjection,
            DungeonPaneInputContext interaction,
            DungeonPaneRenderContext render
    ) {
        this.projection = projection;
        this.interaction = interaction;
        this.render = render;
        this.primaryPressHandler = new DungeonPanePrimaryPressHandler(
                projection,
                gridProjection,
                graphCreationProjection,
                interaction,
                render);
        this.releaseHandler = new DungeonPaneReleaseHandler(interaction, render);
    }

    public void setEditorTool(DungeonEditorTool editorTool) {
        DungeonEditorTool nextTool = editorTool == null ? DungeonEditorTool.SELECT : editorTool;
        render.transitionToTool(nextTool, interaction.selectedCorridorDoorHandle());
        interaction.wallPathController().reset();
        interaction.controller().cancel();
        render.requestRender();
    }

    public void handleLayoutShown(boolean renderNow) {
        render.transitionToShownLayout(interaction.selectedCorridorDoorHandle());
        interaction.wallPathController().reset();
        interaction.controller().cancel();
        if (renderNow) {
            render.requestRender();
        }
    }

    public void handleSelectionUpdated(boolean renderNow) {
        render.transitionToUpdatedSelection(interaction.selectedCorridorDoorHandle());
        if (renderNow) {
            render.requestRender();
        }
    }

    public void refreshViewport() {
        render.requestRender();
    }

    public void setSelectedCorridorDoorHandle(CorridorDoorHandle handle) {
        render.applySelectedCorridorDoorHandle(handle, true);
    }

    public void handleMousePressed(MouseEvent event) {
        if (projection.dungeonLayout() == null) {
            return;
        }
        if (handlePanPress(event)) {
            return;
        }
        CorridorEditInteractionController.PressHit corridorPressHit = interaction.controller().hitTest(event);
        if (interaction.controller().handlePress(corridorPressHit)) {
            return;
        }
        DungeonPanePointerHit pointerHit = pointerHit(event);
        if (primaryPressHandler.handle(event, pointerHit)) {
            return;
        }
    }

    public void handleMouseMoved(MouseEvent event) {
        updatePointerAndCorridorPreview(event);
        interaction.wallPathController().handlePointerMove(event.getX(), event.getY());
    }

    public void handleMouseDragged(MouseEvent event) {
        updatePointerAndCorridorPreview(event);
        if (interaction.interactionState().pointerInteraction() instanceof DungeonPaneInteractionState.PanInteraction) {
            interaction.events().onViewportPanned(new Point2D(event.getX(), event.getY()));
            render.refreshHoverAfterProjectionChange();
            return;
        }
        if (interaction.controller().handleDrag(event)) {
            render.requestRender();
            return;
        }
        interaction.wallPathController().handlePointerMove(event.getX(), event.getY());
        Point2i world = projection.worldPointAt(event.getX(), event.getY());
        if (!interaction.editable() || !(interaction.interactionState().pointerInteraction() instanceof DungeonPaneInteractionState.DragInteraction dragInteraction)) {
            handlePreviewDrag(world);
            return;
        }
        render.updateDragPreview(dragInteraction);
    }

    public void handleMouseReleased(MouseEvent event) {
        if (render.updateCorridorPressMode(event)) {
            render.requestRender();
        }
        if (interaction.interactionState().pointerInteraction() instanceof DungeonPaneInteractionState.PanInteraction) {
            interaction.interactionState().setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
            return;
        }
        releaseHandler.handle(event, pointerHit(event));
    }

    public void handleScroll(ScrollEvent event) {
        interaction.pointerTracker().updatePointerPosition(event.getX(), event.getY());
        double factor = event.getDeltaY() > 0 ? 1.1 : 0.9;
        interaction.events().onViewportZoomed(event.getX(), event.getY(), factor);
        render.refreshHoverAfterProjectionChange();
    }

    public void handleKeyPressed(KeyEvent event) {
        interaction.wallPathController().handleKeyPressed(event);
    }

    public void handlePointerExited() {
        render.onPointerExited();
    }

    private void updatePointerAndCorridorPreview(MouseEvent event) {
        render.updatePointerPosition(event);
        boolean pressModeChanged = render.updateCorridorPressMode(event);
        boolean hoveredChanged = render.updateHoveredCorridorAt(event.getX(), event.getY());
        boolean corridorPreviewChanged = pressModeChanged || hoveredChanged;
        if (corridorPreviewChanged) {
            render.requestRender();
        }
    }

    private boolean handlePanPress(MouseEvent event) {
        if (render.updateCorridorPressMode(event)) {
            render.requestRender();
        }
        if (event.getButton() == MouseButton.SECONDARY && interaction.wallPathController().handleSecondaryPress()) {
            render.requestRender();
            return true;
        }
        if (event.getButton() != MouseButton.SECONDARY) {
            return false;
        }
        interaction.interactionState().setPointerInteraction(new DungeonPaneInteractionState.PanInteraction());
        interaction.events().onViewportPanStarted(new Point2D(event.getX(), event.getY()));
        return true;
    }

    private DungeonPanePointerHit pointerHit(MouseEvent event) {
        return new DungeonPanePointerHit(
                projection.worldPointAt(event.getX(), event.getY()),
                projection.findClusterAt(event.getX(), event.getY()),
                projection.findRoomAt(event.getX(), event.getY()),
                projection.findCorridorAt(event.getX(), event.getY()),
                projection.findCorridorDoorHitAt(event.getX(), event.getY()));
    }

    private void handlePreviewDrag(Point2i world) {
        if (interaction.editable() && interaction.interactionState().pointerInteraction() instanceof DungeonPaneInteractionState.PaintInteraction) {
            render.updatePaintPreview(world);
        }
        if (interaction.editable() && interaction.interactionState().pointerInteraction() instanceof DungeonPaneInteractionState.SelectionInteraction) {
            render.updateSelectionPreview(world);
        }
    }
}
