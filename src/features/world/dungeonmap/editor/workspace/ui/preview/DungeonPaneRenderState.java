package features.world.dungeonmap.editor.workspace.ui.preview;

import features.world.dungeonmap.editor.workspace.ui.base.DungeonEditorTool;
import features.world.dungeonmap.editor.workspace.ui.base.input.DungeonPaneInteractionState;
import features.world.dungeonmap.editor.workspace.ui.base.input.DungeonPanePointerTracker;

public final class DungeonPaneRenderState {

    private final DungeonPreviewState previewState = new DungeonPreviewState();
    private final DungeonPaneInteractionState interactionState = new DungeonPaneInteractionState();
    private final DungeonPanePointerTracker pointerTracker = new DungeonPanePointerTracker();
    private final DungeonPreviewTopologySession previewTopologySession = new DungeonPreviewTopologySession();
    private boolean editable;
    private DungeonEditorTool editorTool = DungeonEditorTool.SELECT;

    public DungeonPreviewState previewState() {
        return previewState;
    }

    public DungeonPaneInteractionState interactionState() {
        return interactionState;
    }

    public DungeonPanePointerTracker pointerTracker() {
        return pointerTracker;
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

    public void transitionToUpdatedSelection() {
        // Keep selection refresh lightweight today, but centralize the hook so
        // future preview state additions are cleared in one named transition.
    }

    public void resetWorkflowState() {
        previewTopologySession.reset();
        previewState.clearTransientPreview();
        interactionState.setPointerInteraction(DungeonPaneInteractionState.IdleInteraction.INSTANCE);
    }
}
