package features.world.dungeonmap.editor.workspace.ui.base.input;

import features.world.dungeonmap.editor.workspace.ui.base.AbstractDungeonPane;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonEditorTool;
import features.world.dungeonmap.editor.session.application.CorridorDoorHandle;
import features.world.dungeonmap.editor.workspace.ui.corridor.CorridorEditInteractionController;
import features.world.dungeonmap.editor.workspace.ui.corridor.DungeonPaneCorridorWorkspace;
import features.world.dungeonmap.editor.workspace.ui.preview.DungeonPanePreviewModel;
import features.world.dungeonmap.editor.workspace.ui.preview.DungeonPaneRenderState;
import features.world.dungeonmap.foundation.geometry.Point2i;
import javafx.scene.input.MouseEvent;

import java.util.Objects;

public final class DungeonPaneRenderContextAdapter implements DungeonPaneRenderContext {

    private final AbstractDungeonPane pane;
    private final DungeonPaneRenderState renderState;
    private final DungeonPanePreviewModel previewModel;
    private final DungeonPaneCorridorWorkspace corridorWorkspace;

    public DungeonPaneRenderContextAdapter(
            AbstractDungeonPane pane,
            DungeonPaneRenderState renderState,
            DungeonPanePreviewModel previewModel,
            DungeonPaneCorridorWorkspace corridorWorkspace
    ) {
        this.pane = Objects.requireNonNull(pane, "pane");
        this.renderState = Objects.requireNonNull(renderState, "renderState");
        this.previewModel = Objects.requireNonNull(previewModel, "previewModel");
        this.corridorWorkspace = Objects.requireNonNull(corridorWorkspace, "corridorWorkspace");
    }

    @Override
    public void transitionToTool(
            DungeonEditorTool editorTool,
            CorridorDoorHandle selectedCorridorDoorHandle
    ) {
        renderState.transitionToTool(editorTool);
        previewModel.clearSelectionPreview();
        previewModel.clearPaintPreview();
        corridorWorkspace.clearCorridorDoorPreview();
        previewModel.clearHoveredCorridor();
        corridorWorkspace.applySelectedCorridorDoorHandle(
                renderState.editorTool() == DungeonEditorTool.SELECT ? selectedCorridorDoorHandle : null,
                false,
                pane::render);
    }

    @Override
    public void transitionToShownLayout(CorridorDoorHandle selectedCorridorDoorHandle) {
        renderState.transitionToShownLayout();
        previewModel.clearSelectionPreview();
        previewModel.clearPaintPreview();
        corridorWorkspace.clearCorridorDoorPreview();
        previewModel.clearHoveredCorridor();
        corridorWorkspace.applySelectedCorridorDoorHandle(selectedCorridorDoorHandle, false, pane::render);
    }

    @Override
    public void transitionToUpdatedSelection(CorridorDoorHandle selectedCorridorDoorHandle) {
        renderState.transitionToUpdatedSelection();
        corridorWorkspace.clearCorridorDoorPreview();
        previewModel.clearHoveredCorridor();
        corridorWorkspace.applySelectedCorridorDoorHandle(selectedCorridorDoorHandle, false, pane::render);
    }

    @Override
    public boolean clearCorridorDoorPreview() {
        return corridorWorkspace.clearCorridorDoorPreview();
    }

    @Override
    public boolean clearHoveredCorridor() {
        return previewModel.clearHoveredCorridor();
    }

    @Override
    public void requestRender() {
        pane.render();
    }

    @Override
    public void applySelectedCorridorDoorHandle(CorridorDoorHandle handle, boolean renderNow) {
        corridorWorkspace.applySelectedCorridorDoorHandle(handle, renderNow, pane::render);
    }

    @Override
    public void updatePointerPosition(MouseEvent event) {
        previewModel.updatePointerPosition(event);
    }

    @Override
    public boolean updateCorridorPressMode(MouseEvent event) {
        return corridorWorkspace.updateCorridorPressMode(event);
    }

    @Override
    public boolean updateHoveredCorridorAt(double screenX, double screenY) {
        return previewModel.updateHoveredCorridorAt(screenX, screenY);
    }

    @Override
    public void refreshHoverAfterProjectionChange() {
        previewModel.refreshHoverAfterProjectionChange();
    }

    @Override
    public void beginSelection(Point2i world) {
        previewModel.beginSelection(world);
    }

    @Override
    public void updateSelectionPreview(Point2i world) {
        previewModel.updateSelectionPreview(world);
    }

    @Override
    public void commitSelection(Point2i start, Point2i end) {
        previewModel.commitSelection(start, end);
    }

    @Override
    public void beginPaint(Point2i world) {
        previewModel.beginPaint(world);
    }

    @Override
    public void updatePaintPreview(Point2i world) {
        previewModel.updatePaintPreview(world);
    }

    @Override
    public void commitPaint(Point2i world) {
        previewModel.commitPaint(world);
    }

    @Override
    public void updateDragPreview(DungeonPaneInteractionState.DragInteraction dragInteraction) {
        previewModel.updateDragPreview(dragInteraction);
    }

    @Override
    public void commitDrag(DungeonPaneInteractionState.DragInteraction dragInteraction) {
        previewModel.commitDrag(dragInteraction);
    }

    @Override
    public void onPointerExited() {
        previewModel.onPointerExited();
    }
}
