package features.world.quarantine.dungeonmap.editor.workspace.preview;

import features.world.quarantine.dungeonmap.editor.workspace.DungeonEditorTool;
import features.world.quarantine.dungeonmap.editor.workspace.interaction.DungeonPaneInteractionState;

public final class DungeonPaneRenderState {

    private final DungeonPreviewState previewState = new DungeonPreviewState();
    private final DungeonPaneInteractionState interactionState = new DungeonPaneInteractionState();
    private final DungeonPreviewTopologySession previewTopologySession = new DungeonPreviewTopologySession();
    private double lastPointerScreenX;
    private double lastPointerScreenY;
    private boolean pointerInsideCanvas;
    private boolean editable;
    private DungeonEditorTool editorTool = DungeonEditorTool.SELECT;

    public DungeonPreviewState previewState() {
        return previewState;
    }

    public DungeonPaneInteractionState interactionState() {
        return interactionState;
    }

    public double lastPointerScreenX() { return lastPointerScreenX; }
    public double lastPointerScreenY() { return lastPointerScreenY; }
    public boolean pointerInsideCanvas() { return pointerInsideCanvas; }

    public void updateTrackerPosition(double x, double y) {
        pointerInsideCanvas = true;
        lastPointerScreenX = x;
        lastPointerScreenY = y;
    }

    public void clearTrackerState() {
        pointerInsideCanvas = false;
    }

    public DungeonPreviewTopologySession previewTopologySession() {
        return previewTopologySession;
    }

    public boolean editable() {
        return editable;
    }

    public void setEditable(boolean editable) {
        this.editable = editable;
    }

    public DungeonEditorTool editorTool() {
        return editorTool;
    }

    public void setEditorTool(DungeonEditorTool editorTool) {
        this.editorTool = editorTool == null ? DungeonEditorTool.SELECT : editorTool;
    }

    public void transitionToTool(DungeonEditorTool editorTool) {
        setEditorTool(editorTool);
        resetWorkflowState();
    }

    public void transitionToShownLayout() {
        resetWorkflowState();
    }

    public void resetWorkflowState() {
        previewTopologySession.reset();
        previewState.clearTransientPreview();
        interactionState.setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
    }
}
