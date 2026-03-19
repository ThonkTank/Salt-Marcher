package features.world.quarantine.dungeonmap.editor.workspace.interaction;

import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonEditorTool;
import features.world.quarantine.dungeonmap.editor.workspace.contract.DungeonPaneInteractionSink;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonViewMode;
import features.world.quarantine.dungeonmap.editor.selection.CorridorDoorHandle;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.CorridorDoorHit;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.CorridorEditInteractionController;
import features.world.quarantine.dungeonmap.editor.workspace.corridor.DungeonPaneCorridorWorkspace;
import features.world.quarantine.dungeonmap.editor.workspace.preview.DungeonPanePreviewModel;
import features.world.quarantine.dungeonmap.editor.workspace.preview.DungeonPaneRenderState;
import features.world.quarantine.dungeonmap.editor.workspace.wallpath.WallPathInteractionController;
import features.world.quarantine.dungeonmap.editor.workspace.pane.AbstractDungeonPane;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import javafx.geometry.Point2D;
import javafx.scene.input.KeyEvent;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;
import javafx.scene.input.ScrollEvent;

import java.util.Objects;
import java.util.function.Supplier;

public final class DungeonPanePointerController {

    private final DungeonPanePointerProjection projection;
    private final AbstractDungeonPane pane;
    private final DungeonPaneRenderState renderState;
    private final DungeonPanePreviewModel previewModel;
    private final DungeonPaneCorridorWorkspace corridorWorkspace;
    private final DungeonPanePrimaryPressHandler primaryPressHandler;
    private final DungeonPaneReleaseHandler releaseHandler;
    private final Supplier<DungeonPaneInteractionSink> interactionSinkSupplier;
    private CorridorEditInteractionController corridorController;
    private WallPathInteractionController wallPathController;

    public DungeonPanePointerController(
            DungeonPanePointerProjection projection,
            AbstractDungeonPane pane,
            DungeonPaneRenderState renderState,
            DungeonPanePreviewModel previewModel,
            DungeonPaneCorridorWorkspace corridorWorkspace,
            Supplier<DungeonPaneInteractionSink> interactionSinkSupplier
    ) {
        this.projection = projection;
        this.pane = Objects.requireNonNull(pane, "pane");
        this.renderState = Objects.requireNonNull(renderState, "renderState");
        this.previewModel = Objects.requireNonNull(previewModel, "previewModel");
        this.corridorWorkspace = Objects.requireNonNull(corridorWorkspace, "corridorWorkspace");
        this.interactionSinkSupplier = Objects.requireNonNull(interactionSinkSupplier, "interactionSinkSupplier");
        this.primaryPressHandler = new DungeonPanePrimaryPressHandler(projection, this, previewModel);
        this.releaseHandler = new DungeonPaneReleaseHandler(this, previewModel, corridorWorkspace);
    }

    /** Phase-2 init: injects the corridor edit controller after both objects are constructed. */
    public void initCorridorController(CorridorEditInteractionController corridorController) {
        this.corridorController = Objects.requireNonNull(corridorController, "corridorController");
    }

    /** Phase-2 init: injects the wall-path controller after both objects are constructed. */
    public void initWallPathController(WallPathInteractionController wallPathController) {
        this.wallPathController = Objects.requireNonNull(wallPathController, "wallPathController");
    }

    // Package-private accessors used by DungeonPanePrimaryPressHandler and DungeonPaneReleaseHandler
    boolean editable() { return renderState.editable(); }
    DungeonEditorTool editorTool() { return renderState.editorTool(); }
    DungeonViewMode viewMode() { return pane.viewMode(); }
    DungeonPaneInteractionSink events() { return interactionSinkSupplier.get(); }
    DungeonPaneInteractionState interactionState() { return renderState.interactionState(); }
    CorridorEditInteractionController corridorController() {
        if (corridorController == null) throw new IllegalStateException("initCorridorController() not called");
        return corridorController;
    }
    WallPathInteractionController wallPathController() {
        if (wallPathController == null) throw new IllegalStateException("initWallPathController() not called");
        return wallPathController;
    }
    CorridorDoorHandle selectedCorridorDoorHandle() {
        return renderState.previewState().selectedCorridorDoorHandle();
    }
    void requestRender() { pane.render(); }

    // Transition helper: coordinates state across renderState, previewModel, and corridorWorkspace
    private void doTransition(Runnable renderStateTransition, boolean clearPreview, CorridorDoorHandle handle) {
        renderStateTransition.run();
        if (clearPreview) {
            previewModel.preview().clearSelectionPreview();
            previewModel.preview().clearPaintPreview();
        }
        corridorWorkspace.clearCorridorDoorPreview();
        previewModel.preview().clearHoveredCorridor();
        corridorWorkspace.applySelectedCorridorDoorHandle(
                renderState.editorTool() == DungeonEditorTool.SELECT ? handle : null,
                false, pane::render);
    }

    public void setEditorTool(DungeonEditorTool editorTool) {
        DungeonEditorTool nextTool = editorTool == null ? DungeonEditorTool.SELECT : editorTool;
        doTransition(() -> renderState.transitionToTool(nextTool), true, selectedCorridorDoorHandle());
        wallPathController().reset();
        corridorController().cancel();
        requestRender();
    }

    public void handleLayoutShown(boolean renderNow) {
        doTransition(renderState::transitionToShownLayout, true, selectedCorridorDoorHandle());
        wallPathController().reset();
        corridorController().cancel();
        if (renderNow) {
            requestRender();
        }
    }

    public void handleSelectionUpdated(boolean renderNow) {
        doTransition(() -> {}, false, selectedCorridorDoorHandle());
        if (renderNow) {
            requestRender();
        }
    }

    public void refreshViewport() {
        requestRender();
    }

    public void setSelectedCorridorDoorHandle(CorridorDoorHandle handle) {
        corridorWorkspace.applySelectedCorridorDoorHandle(handle, true, pane::render);
    }

    public void handleMousePressed(MouseEvent event) {
        if (projection.dungeonLayout() == null) {
            return;
        }
        if (handlePanPress(event)) {
            return;
        }
        CorridorEditInteractionController.PressHit corridorPressHit = corridorController().hitTest(event);
        if (corridorController().handlePress(corridorPressHit)) {
            return;
        }
        DungeonPanePointerHit pointerHit = pointerHit(event);
        primaryPressHandler.handle(event, pointerHit);
    }

    public void handleMouseMoved(MouseEvent event) {
        updatePointerAndCorridorPreview(event);
        wallPathController().handlePointerMove(event.getX(), event.getY());
    }

    public void handleMouseDragged(MouseEvent event) {
        updatePointerAndCorridorPreview(event);
        if (interactionState().pointerInteraction() instanceof DungeonPaneInteractionState.PanInteraction) {
            events().onViewportPanned(new Point2D(event.getX(), event.getY()));
            previewModel.preview().refreshHoverAfterProjectionChange();
            return;
        }
        if (corridorController().handleDrag(event)) {
            requestRender();
            return;
        }
        wallPathController().handlePointerMove(event.getX(), event.getY());
        Point2i world = projection.worldPointAt(event.getX(), event.getY());
        if (!editable() || !(interactionState().pointerInteraction() instanceof DungeonPaneInteractionState.DragInteraction dragInteraction)) {
            handlePreviewDrag(world);
            return;
        }
        previewModel.preview().updateDragPreview(dragInteraction);
    }

    public void handleMouseReleased(MouseEvent event) {
        if (corridorWorkspace.updateCorridorPressMode(event)) {
            requestRender();
        }
        if (interactionState().pointerInteraction() instanceof DungeonPaneInteractionState.PanInteraction) {
            interactionState().setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
            return;
        }
        releaseHandler.handle(event, pointerHit(event));
    }

    public void handleScroll(ScrollEvent event) {
        renderState.updateTrackerPosition(event.getX(), event.getY());
        double factor = event.getDeltaY() > 0 ? 1.1 : 0.9;
        events().onViewportZoomed(event.getX(), event.getY(), factor);
        previewModel.preview().refreshHoverAfterProjectionChange();
    }

    public void handleKeyPressed(KeyEvent event) {
        wallPathController().handleKeyPressed(event);
    }

    public void handlePointerExited() {
        previewModel.preview().onPointerExited();
    }

    private void updatePointerAndCorridorPreview(MouseEvent event) {
        previewModel.preview().updatePointerPosition(event);
        boolean pressModeChanged = corridorWorkspace.updateCorridorPressMode(event);
        boolean hoveredChanged = previewModel.preview().updateHoveredCorridorAt(new features.world.quarantine.dungeonmap.foundation.geometry.ScreenPoint(event.getX(), event.getY()));
        if (pressModeChanged || hoveredChanged) {
            requestRender();
        }
    }

    private boolean handlePanPress(MouseEvent event) {
        if (corridorWorkspace.updateCorridorPressMode(event)) {
            requestRender();
        }
        if (event.getButton() == MouseButton.SECONDARY && wallPathController().handleSecondaryPress()) {
            requestRender();
            return true;
        }
        if (event.getButton() != MouseButton.SECONDARY) {
            return false;
        }
        interactionState().setPointerInteraction(new DungeonPaneInteractionState.PanInteraction());
        events().onViewportPanStarted(new Point2D(event.getX(), event.getY()));
        return true;
    }

    private DungeonPanePointerHit pointerHit(MouseEvent event) {
        var screen = new features.world.quarantine.dungeonmap.foundation.geometry.ScreenPoint(event.getX(), event.getY());
        var hitTests = projection.hitTests();
        return new DungeonPanePointerHit(
                projection.worldPointAt(event.getX(), event.getY()),
                hitTests.findClusterAt(screen),
                hitTests.findRoomAt(screen),
                hitTests.findCorridorAt(screen),
                hitTests.findCorridorDoorHitAt(screen));
    }

    private void handlePreviewDrag(Point2i world) {
        if (editable() && interactionState().pointerInteraction() instanceof DungeonPaneInteractionState.PaintInteraction) {
            previewModel.preview().updatePaintPreview(world);
        }
        if (editable() && interactionState().pointerInteraction() instanceof DungeonPaneInteractionState.SelectionInteraction) {
            previewModel.preview().updateSelectionPreview(world);
        }
    }

    static record DungeonPanePointerHit(
            Point2i world,
            DungeonRoomCluster cluster,
            DungeonRoom room,
            DungeonCorridor corridor,
            CorridorDoorHit corridorDoorHit
    ) {}
}
