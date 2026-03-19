package features.world.quarantine.dungeonmap.editor.workspace.corridor;

import features.world.quarantine.dungeonmap.editor.selection.CorridorDoorHandle;
import features.world.quarantine.dungeonmap.editor.workspace.pane.AbstractDungeonPane;
import features.world.quarantine.dungeonmap.editor.workspace.pane.DungeonPaneSceneState;
import features.world.quarantine.dungeonmap.editor.workspace.preview.DungeonPanePreviewModel;
import features.world.quarantine.dungeonmap.editor.workspace.preview.DungeonPaneRenderState;
import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorGeometry;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.canvas.state.DungeonLayoutRenderData;
import javafx.scene.input.MouseEvent;

import java.util.Objects;

public final class DungeonPaneCorridorWorkspace {

    private final AbstractDungeonPane pane;
    private final DungeonPaneRenderState renderState;
    private final DungeonPaneCorridorHitResolver corridorInteractionSupport;
    private final DungeonCorridorDoorProjector corridorProjectionSupport;
    private final DungeonCorridorDragPreviewManager dragPreviewManager;
    private CorridorEditInteractionController controller;

    public DungeonPaneCorridorWorkspace(
            AbstractDungeonPane pane,
            DungeonPaneSceneState sceneState,
            DungeonPaneRenderState renderState,
            DungeonPanePreviewModel previewModel
    ) {
        this.pane = Objects.requireNonNull(pane, "pane");
        this.renderState = Objects.requireNonNull(renderState, "renderState");
        this.corridorProjectionSupport = new DungeonCorridorDoorProjector(
                pane, this::corridorGeometryForSelection, previewModel.geometry(), renderState::editorTool);
        this.corridorInteractionSupport = new DungeonPaneCorridorHitResolver(
                DungeonPaneCorridorHitResolver.createHost(pane, renderState, previewModel, corridorProjectionSupport));
        this.dragPreviewManager = new DungeonCorridorDragPreviewManager(previewModel, renderState, corridorProjectionSupport);
    }

    /** Phase-2 init: injects the corridor edit controller after both objects are constructed. */
    public void initController(CorridorEditInteractionController controller) {
        this.controller = Objects.requireNonNull(controller, "controller");
    }

    private CorridorGeometry corridorGeometryForSelection(DungeonCorridor corridor) {
        if (corridor == null || corridor.corridorId() == null) {
            return null;
        }
        CorridorGeometry previewGeometry = renderState.previewTopologySession().corridorGeometryOverride(corridor.corridorId());
        if (previewGeometry != null) {
            return previewGeometry;
        }
        DungeonLayoutRenderData renderData = pane.renderData();
        return renderData == null ? null : renderData.corridorGeometry(corridor.corridorId());
    }

    // --- Subsystem accessors ---

    public DungeonPaneCorridorHitResolver corridorInteractionSupport() {
        return corridorInteractionSupport;
    }

    public DungeonCorridorDoorProjector corridorProjectionSupport() {
        return corridorProjectionSupport;
    }

    public DungeonCorridorDragPreviewManager dragPreviewManager() {
        return dragPreviewManager;
    }

    // --- Coordination ---

    public void applySelectedCorridorDoorHandle(
            CorridorDoorHandle handle,
            boolean renderNow,
            Runnable renderAction
    ) {
        CorridorDoorHandle normalizedHandle = corridorProjectionSupport.normalizeCorridorDoorHandle(handle);
        if (Objects.equals(renderState.previewState().selectedCorridorDoorHandle(), normalizedHandle)) {
            if (renderNow) {
                renderAction.run();
            }
            return;
        }
        renderState.previewState().setSelectedCorridorDoorHandle(normalizedHandle);
        if (renderNow) {
            renderAction.run();
        }
    }

    public CorridorEditInteractionController.PressMode corridorPressMode() {
        return requireController().previewPressMode();
    }

    public boolean updateCorridorPressMode(MouseEvent event) {
        return requireController().updatePreviewPressMode(event);
    }

    public void clearCorridorPressModePreview() {
        requireController().clearPreviewPressMode();
    }

    public CorridorGeometry routableGeometryForDisplay(DungeonCorridor corridor) {
        CorridorGeometry geometry = corridorInteractionSupport.corridorGeometryForDisplay(corridor);
        return (geometry != null && geometry.routable()) ? geometry : null;
    }

    public CorridorDoorHandle selectedCorridorDoorHandle() {
        return renderState.previewState().selectedCorridorDoorHandle();
    }

    public boolean clearCorridorDoorPreview() {
        return dragPreviewManager.clearCorridorDoorPreview();
    }

    private CorridorEditInteractionController requireController() {
        if (controller == null) throw new IllegalStateException("initController() not called");
        return controller;
    }
}
