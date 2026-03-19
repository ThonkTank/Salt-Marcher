package features.world.quarantine.dungeonmap.editor.session.tool;

import features.world.quarantine.dungeonmap.editor.session.DungeonEditorSessionState;
import features.world.quarantine.dungeonmap.editor.session.EditorWorkspacePort;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonEditorTool;
import features.world.quarantine.dungeonmap.editor.workspace.DungeonViewMode;
import features.world.quarantine.dungeonmap.editor.workspace.wallpath.DungeonWallPathState;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridorEndpoint;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;

import java.util.Objects;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.function.Supplier;

public final class DungeonEditorToolSessionController {

    private final DungeonToolModeState toolModeState;
    private final Consumer<DungeonEditorTool> displayedToolUpdater;
    private final EditorWorkspacePort workspace;
    private final DungeonEditorSessionState sessionState;
    private final BooleanSupplier editingEnabledSupplier;
    private final Supplier<DungeonLayout> currentLayoutSupplier;
    private final Runnable statePaneChanged;
    private final DungeonCorridorDraftController corridorDraftController;

    private DungeonWallPathState suspendedWallPathState;

    public DungeonEditorToolSessionController(
            DungeonToolModeState toolModeState,
            Consumer<DungeonEditorTool> displayedToolUpdater,
            EditorWorkspacePort workspace,
            DungeonEditorSessionState sessionState,
            BooleanSupplier editingEnabledSupplier,
            Supplier<DungeonLayout> currentLayoutSupplier,
            Runnable statePaneChanged,
            DungeonCorridorDraftController corridorDraftController
    ) {
        this.toolModeState = Objects.requireNonNull(toolModeState, "toolModeState");
        this.displayedToolUpdater = Objects.requireNonNull(displayedToolUpdater, "displayedToolUpdater");
        this.workspace = Objects.requireNonNull(workspace, "workspace");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.editingEnabledSupplier = Objects.requireNonNull(editingEnabledSupplier, "editingEnabledSupplier");
        this.currentLayoutSupplier = Objects.requireNonNull(currentLayoutSupplier, "currentLayoutSupplier");
        this.statePaneChanged = Objects.requireNonNull(statePaneChanged, "statePaneChanged");
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
        displayedToolUpdater.accept(activeTool);
        workspace.setEditorTool(activeTool);
    }

    public void setViewMode(DungeonViewMode viewMode) {
        DungeonViewMode nextViewMode = viewMode == null ? DungeonViewMode.GRID : viewMode;
        if (nextViewMode == DungeonViewMode.GRAPH && activeTool().isWallTool()) {
            workspace.wallPathState().cancelWallPath();
        }
        workspace.setViewMode(nextViewMode, activeTool());
    }

    public void setSelectedTool(DungeonEditorTool editorTool) {
        DungeonEditorTool nextTool = editorTool == null ? DungeonEditorTool.SELECT : editorTool;
        if (!toolModeState.deleteOverrideActive() && toolModeState.selectedTool() == nextTool) {
            return;
        }
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
        statePaneChanged.run();
    }

    public void selectCorridorTarget(DungeonCorridorEndpoint target) {
        if (!editingEnabledSupplier.getAsBoolean()
                || currentLayoutSupplier.get() == null
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
                statePaneChanged.run();
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
