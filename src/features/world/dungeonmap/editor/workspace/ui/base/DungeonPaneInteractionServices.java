package features.world.dungeonmap.editor.workspace.ui.base;

import features.world.dungeonmap.editor.session.application.CorridorDoorHandle;
import features.world.dungeonmap.editor.session.application.CorridorWaypointHandle;
import features.world.dungeonmap.editor.workspace.ui.corridor.CorridorEditInteractionController;
import features.world.dungeonmap.editor.workspace.ui.corridor.DungeonPaneCorridorWorkspace;
import features.world.dungeonmap.editor.workspace.ui.preview.DungeonPanePreviewModel;
import features.world.dungeonmap.editor.workspace.ui.preview.DungeonPaneRenderState;
import features.world.dungeonmap.editor.workspace.ui.preview.DungeonPaneSelectionAreaProjection;
import features.world.dungeonmap.editor.workspace.ui.base.input.DungeonPaneGraphCreationProjection;
import features.world.dungeonmap.editor.workspace.ui.base.input.DungeonPaneGridPointerProjection;
import features.world.dungeonmap.editor.workspace.ui.base.input.DungeonPaneInputContextAdapter;
import features.world.dungeonmap.editor.workspace.ui.base.input.DungeonPanePointerController;
import features.world.dungeonmap.editor.workspace.ui.base.input.DungeonPanePointerProjection;
import features.world.dungeonmap.editor.workspace.ui.base.input.DungeonPaneRenderContextAdapter;
import features.world.dungeonmap.editor.workspace.ui.wallpath.DungeonPaneWallPathHostAdapter;
import features.world.dungeonmap.editor.workspace.ui.wallpath.DungeonPaneWallPathProjection;
import features.world.dungeonmap.editor.workspace.ui.wallpath.WallPathInteractionController;
import features.world.dungeonmap.foundation.geometry.Point2i;
import javafx.scene.canvas.Canvas;
import javafx.scene.input.KeyEvent;
import javafx.scene.input.MouseEvent;
import javafx.scene.input.ScrollEvent;

import java.util.Objects;

public final class DungeonPaneInteractionServices {

    private final DungeonPaneRenderState renderState = new DungeonPaneRenderState();
    private final DungeonPaneInputContextAdapter inputContext;
    private final DungeonPaneRenderContextAdapter renderContext;
    private final DungeonPanePointerController pointerController;
    private final WallPathInteractionController wallPathController;
    private final DungeonPanePreviewModel previewModel;
    private final DungeonPaneCorridorWorkspace corridorWorkspace;
    private DungeonPaneInteractionSink interactionSink = DungeonPaneInteractionSink.NO_OP;

    public DungeonPaneInteractionServices(
            AbstractDungeonPane pane,
            DungeonPanePointerProjection projection,
            Canvas canvas,
            DungeonPaneGridPointerProjection gridProjection,
            DungeonPaneGraphCreationProjection graphCreationProjection,
            DungeonPaneSelectionAreaProjection selectionAreaProjection,
            DungeonPaneWallPathProjection wallPathProjection
    ) {
        Objects.requireNonNull(pane, "pane");
        Objects.requireNonNull(projection, "projection");
        Objects.requireNonNull(canvas, "canvas");
        this.previewModel = new DungeonPanePreviewModel(pane, renderState, selectionAreaProjection);
        this.corridorWorkspace = new DungeonPaneCorridorWorkspace(pane, pane.sceneState(), renderState, previewModel);
        DungeonPaneWallPathHostAdapter wallPathHost =
                new DungeonPaneWallPathHostAdapter(pane, renderState, previewModel, wallPathProjection);
        this.inputContext = new DungeonPaneInputContextAdapter(pane, renderState, previewModel);
        this.renderContext = new DungeonPaneRenderContextAdapter(pane, renderState, previewModel, corridorWorkspace);
        CorridorEditInteractionController corridorEditController = new CorridorEditInteractionController(
                corridorWorkspace, createCorridorCallbacks());
        this.wallPathController = new WallPathInteractionController(wallPathHost);
        this.pointerController = new DungeonPanePointerController(
                projection,
                Objects.requireNonNull(gridProjection, "gridProjection"),
                Objects.requireNonNull(graphCreationProjection, "graphCreationProjection"),
                inputContext,
                renderContext);
        pane.setFocusTraversable(true);
        pane.addEventHandler(KeyEvent.KEY_PRESSED, pointerController::handleKeyPressed);
        canvas.addEventHandler(MouseEvent.MOUSE_PRESSED, event -> pane.requestFocus());
        canvas.addEventHandler(MouseEvent.MOUSE_PRESSED, pointerController::handleMousePressed);
        canvas.addEventHandler(MouseEvent.MOUSE_MOVED, pointerController::handleMouseMoved);
        canvas.addEventHandler(MouseEvent.MOUSE_DRAGGED, pointerController::handleMouseDragged);
        canvas.addEventHandler(MouseEvent.MOUSE_RELEASED, pointerController::handleMouseReleased);
        canvas.addEventHandler(MouseEvent.MOUSE_EXITED, event -> pointerController.handlePointerExited());
        canvas.addEventHandler(ScrollEvent.SCROLL, pointerController::handleScroll);
        this.corridorWorkspace.bindController(corridorEditController);
        this.previewModel.bindCorridorWorkspace(corridorWorkspace);
        this.inputContext.bindControllers(corridorEditController, this.wallPathController);
    }

    public void bindInteractionSink(DungeonPaneInteractionSink interactionSink) {
        this.interactionSink = Objects.requireNonNull(interactionSink, "interactionSink");
        previewModel.bindInteractionSink(this.interactionSink);
        inputContext.bindInteractionSink(this.interactionSink);
    }

    private CorridorEditInteractionController.Callbacks createCorridorCallbacks() {
        return new CorridorEditInteractionController.Callbacks() {
            @Override
            public void onCorridorDoorSelected(CorridorDoorHandle handle) {
                CorridorDoorHandle previousHandle = inputContext.selectedCorridorDoorHandle();
                renderContext.applySelectedCorridorDoorHandle(handle, true);
                CorridorDoorHandle normalizedHandle = inputContext.selectedCorridorDoorHandle();
                interactionSink.onCorridorDoorSelected(normalizedHandle);
                if (!Objects.equals(previousHandle, normalizedHandle)) {
                    interactionSink.onCorridorDoorSelectionChanged(normalizedHandle);
                }
            }

            @Override
            public void onCorridorDoorMoved(
                    CorridorDoorHandle handle,
                    CorridorEditInteractionController.DoorMoveTarget target
            ) {
                interactionSink.onCorridorDoorMoved(handle, target);
            }

            @Override
            public void onCorridorWaypointSelected(CorridorWaypointHandle handle) {
                interactionSink.onCorridorWaypointSelected(handle);
            }

            @Override
            public void onCorridorWaypointAdded(CorridorEditInteractionController.SegmentInsertHit hit) {
                interactionSink.onCorridorWaypointAdded(hit);
            }

            @Override
            public void onCorridorWaypointRemoved(CorridorWaypointHandle handle) {
                interactionSink.onCorridorWaypointRemoved(handle);
            }

            @Override
            public void onCorridorWaypointMoved(CorridorWaypointHandle handle, Point2i cell) {
                interactionSink.onCorridorWaypointMoved(handle, cell);
            }
        };
    }

    public DungeonPaneRenderState renderState() {
        return renderState;
    }

    public DungeonPanePointerController pointerController() {
        return pointerController;
    }

    public WallPathInteractionController wallPathController() {
        return wallPathController;
    }

    public DungeonPanePreviewModel previewModel() {
        return previewModel;
    }

    public DungeonPaneCorridorWorkspace corridorWorkspace() {
        return corridorWorkspace;
    }

    public DungeonPaneInteractionSink interactionSink() {
        return interactionSink;
    }
}
