package features.world.quarantine.dungeonmap.editor.session.edit;

import features.world.quarantine.dungeonmap.editor.session.selection.DungeonEditorSelectionController;
import features.world.quarantine.dungeonmap.editor.session.EditorWorkspacePort;
import features.world.quarantine.dungeonmap.editor.shell.DungeonEditorUiFeedback;
import features.world.quarantine.dungeonmap.loading.DungeonLoadingCapability;
import ui.async.UiErrorReporter;

import java.util.Objects;
final class DungeonEditorEditResultCoordinator {

    private final EditorWorkspacePort workspace;
    private final DungeonEditorSelectionController selectionController;
    private final Runnable clearTransientState;
    private final DungeonLoadingCapability loadingCapability;
    private final DungeonEditorUiFeedback uiFeedback;

    DungeonEditorEditResultCoordinator(
            EditorWorkspacePort workspace,
            DungeonEditorSelectionController selectionController,
            Runnable clearTransientState,
            DungeonLoadingCapability loadingCapability,
            DungeonEditorUiFeedback uiFeedback
    ) {
        this.workspace = Objects.requireNonNull(workspace, "workspace");
        this.selectionController = Objects.requireNonNull(selectionController, "selectionController");
        this.clearTransientState = Objects.requireNonNull(clearTransientState, "clearTransientState");
        this.loadingCapability = Objects.requireNonNull(loadingCapability, "loadingCapability");
        this.uiFeedback = Objects.requireNonNull(uiFeedback, "uiFeedback");
    }

    void apply(DungeonEditorSessionEditOutcome outcome) {
        if (outcome == null || outcome.layout() == null) {
            uiFeedback.onReloadRequested(loadingCapability.sessionMapId());
            return;
        }
        if (outcome.clearTransientState()) {
            clearTransientState.run();
        }
        if (outcome.nextWallAnchor() != null) {
            workspace.wallPathState().applyWallPathCommitResult(outcome.nextWallAnchor());
        }
        selectionController.prepareLayoutRefreshSelection(
                outcome.layout(),
                outcome.replaceSelection() ? outcome.focusSelection() : selectionController.selectedTarget(),
                outcome.corridorSelectionIntent());
        uiFeedback.onLayoutChanged(outcome.layout());
    }

    void handleFailure(String action, Throwable throwable) {
        UiErrorReporter.reportBackgroundFailure(action, throwable);
        clearTransientState.run();
        uiFeedback.onReloadRequested(loadingCapability.sessionMapId());
    }
}
