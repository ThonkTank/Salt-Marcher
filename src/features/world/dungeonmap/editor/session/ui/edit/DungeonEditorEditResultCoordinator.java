package features.world.dungeonmap.editor.session.ui.edit;

import features.world.dungeonmap.editor.session.ui.port.DungeonEditorSessionReadModel;
import features.world.dungeonmap.editor.session.ui.port.DungeonEditorSessionUpdate;
import features.world.dungeonmap.editor.session.ui.port.DungeonEditorSessionUpdateSink;
import features.world.dungeonmap.editor.session.ui.DungeonEditorSelectionController;
import features.world.dungeonmap.editor.workspace.ui.DungeonEditorSplitWorkspace;
import ui.async.UiErrorReporter;

import java.util.Objects;
final class DungeonEditorEditResultCoordinator {

    private final DungeonEditorSplitWorkspace workspace;
    private final DungeonEditorSelectionController selectionController;
    private final Runnable clearTransientState;
    private final DungeonEditorSessionReadModel sessionReadModel;
    private final DungeonEditorSessionUpdateSink sessionUpdateSink;

    DungeonEditorEditResultCoordinator(
            DungeonEditorSplitWorkspace workspace,
            DungeonEditorSelectionController selectionController,
            Runnable clearTransientState,
            DungeonEditorSessionReadModel sessionReadModel,
            DungeonEditorSessionUpdateSink sessionUpdateSink
    ) {
        this.workspace = Objects.requireNonNull(workspace, "workspace");
        this.selectionController = Objects.requireNonNull(selectionController, "selectionController");
        this.clearTransientState = Objects.requireNonNull(clearTransientState, "clearTransientState");
        this.sessionReadModel = Objects.requireNonNull(sessionReadModel, "sessionReadModel");
        this.sessionUpdateSink = Objects.requireNonNull(sessionUpdateSink, "sessionUpdateSink");
    }

    void apply(DungeonEditorSessionEditOutcome outcome) {
        if (outcome == null || outcome.layout() == null) {
            sessionUpdateSink.applySessionUpdate(DungeonEditorSessionUpdate.reloadLayout(sessionReadModel.activeEditSessionId()));
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
        sessionUpdateSink.applySessionUpdate(DungeonEditorSessionUpdate.layoutChanged(outcome.layout()));
    }

    void handleFailure(String action, Throwable throwable) {
        UiErrorReporter.reportBackgroundFailure(action, throwable);
        clearTransientState.run();
        sessionUpdateSink.applySessionUpdate(DungeonEditorSessionUpdate.reloadLayout(sessionReadModel.activeEditSessionId()));
    }
}
