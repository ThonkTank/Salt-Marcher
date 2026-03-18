package features.world.dungeonmap.editor.session.ui.tool;

import features.world.dungeonmap.editor.session.ui.port.DungeonEditorSessionReadModel;
import features.world.dungeonmap.editor.session.ui.port.DungeonEditorSessionUpdate;
import features.world.dungeonmap.editor.session.ui.port.DungeonEditorSessionUpdateSink;
import features.world.dungeonmap.editor.session.application.DungeonEditorSessionState;
import features.world.dungeonmap.editor.shell.ui.DungeonEditorControls;
import features.world.dungeonmap.editor.shell.ui.DungeonToolModeState;
import features.world.dungeonmap.editor.workspace.ui.DungeonEditorSplitWorkspace;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonEditorTool;
import features.world.dungeonmap.editor.workspace.ui.base.DungeonViewMode;
import features.world.dungeonmap.editor.workspace.ui.wallpath.DungeonWallPathState;
import features.world.dungeonmap.corridors.model.DungeonCorridorEndpoint;

import java.util.Objects;

public final class DungeonEditorToolSessionController {

    private final DungeonToolModeState toolModeState;
    private final DungeonEditorControls controls;
    private final DungeonEditorSplitWorkspace workspace;
    private final DungeonEditorSessionState sessionState;
    private final DungeonEditorSessionReadModel sessionReadModel;
    private final DungeonEditorSessionUpdateSink sessionUpdateSink;
    private final DungeonCorridorDraftController corridorDraftController;

    private DungeonWallPathState suspendedWallPathState;

    public DungeonEditorToolSessionController(
            DungeonToolModeState toolModeState,
            DungeonEditorControls controls,
            DungeonEditorSplitWorkspace workspace,
            DungeonEditorSessionState sessionState,
            DungeonEditorSessionReadModel sessionReadModel,
            DungeonEditorSessionUpdateSink sessionUpdateSink,
            DungeonCorridorDraftController corridorDraftController
    ) {
        this.toolModeState = Objects.requireNonNull(toolModeState, "toolModeState");
        this.controls = Objects.requireNonNull(controls, "controls");
        this.workspace = Objects.requireNonNull(workspace, "workspace");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.sessionReadModel = Objects.requireNonNull(sessionReadModel, "sessionReadModel");
        this.sessionUpdateSink = Objects.requireNonNull(sessionUpdateSink, "sessionUpdateSink");
        this.corridorDraftController = Objects.requireNonNull(corridorDraftController, "corridorDraftController");
    }

    public DungeonEditorTool activeTool() {
        return toolModeState.activeTool();
    }

    public DungeonEditorTool preferredToolFor(DungeonEditorTool toolFamilyMember) {
        return toolModeState.preferredToolFor(toolFamilyMember);
    }

    public void syncEditorTool() {
        DungeonEditorTool activeTool = activeTool();
        controls.showDisplayedTool(activeTool);
        workspace.setEditorTool(activeTool);
    }

    public void setViewMode(DungeonViewMode viewMode) {
        DungeonViewMode nextViewMode = viewMode == null ? DungeonViewMode.GRID : viewMode;
        if (nextViewMode == DungeonViewMode.GRAPH && activeTool().isWallTool()) {
            workspace.wallPathState().cancelWallPath();
        }
        workspace.setViewMode(nextViewMode);
    }

    public void setSelectedTool(DungeonEditorTool editorTool) {
        toolModeState.selectPersistentTool(editorTool);
        corridorDraftController.clearDraft();
        applyActiveTool();
    }

    public boolean switchPersistentToolMode(boolean deleteMode) {
        DungeonEditorTool nextTool = toolModeState.switchPersistentMode(deleteMode);
        if (nextTool == null) {
            return false;
        }
        corridorDraftController.clearDraft();
        applyActiveTool();
        return true;
    }

    public boolean setDeleteOverrideActive(boolean active) {
        if (active) {
            DungeonEditorTool deleteTool = toolModeState.selectedTool().deleteVariant();
            if (toolModeState.deleteOverrideActive() || deleteTool == activeTool()) {
                return false;
            }
            suspendTemporaryToolState();
            toolModeState.showDeleteOverride();
            applyActiveTool();
            return true;
        }
        if (!toolModeState.deleteOverrideActive()) {
            return false;
        }
        toolModeState.clearDeleteOverride();
        applyActiveTool();
        restoreSuspendedToolState();
        return true;
    }

    public void clearTransientState() {
        sessionState.clearTransientState();
        sessionUpdateSink.applySessionUpdate(DungeonEditorSessionUpdate.statePaneChanged());
    }

    public void selectCorridorTarget(DungeonCorridorEndpoint target) {
        if (!sessionReadModel.editingEnabled()
                || sessionReadModel.activeEditSessionId() == null
                || sessionReadModel.currentLayout() == null
                || target == null
                || activeTool() != DungeonEditorTool.CORRIDOR_CREATE) {
            return;
        }
        corridorDraftController.selectTarget(target);
    }

    private void applyActiveTool() {
        if (activeTool() != DungeonEditorTool.CORRIDOR_CREATE) {
            clearTransientState();
        }
        syncEditorTool();
    }

    private void suspendTemporaryToolState() {
        if (toolModeState.selectedTool() == DungeonEditorTool.CORRIDOR_CREATE) {
            corridorDraftController.snapshotDraft();
        } else {
            corridorDraftController.clearSuspendedDraft();
        }
        suspendedWallPathState = toolModeState.selectedTool().isWallTool() ? workspace.wallPathState().snapshotWallPathState() : null;
    }

    private void restoreSuspendedToolState() {
        if (toolModeState.selectedTool() == DungeonEditorTool.CORRIDOR_CREATE) {
            if (corridorDraftController.restoreDraft()) {
                sessionUpdateSink.applySessionUpdate(DungeonEditorSessionUpdate.statePaneChanged());
            }
        } else {
            corridorDraftController.clearSuspendedDraft();
        }
        if (toolModeState.selectedTool().isWallTool() && suspendedWallPathState != null) {
            workspace.wallPathState().restoreWallPathState(suspendedWallPathState);
        }
        suspendedWallPathState = null;
    }
}
