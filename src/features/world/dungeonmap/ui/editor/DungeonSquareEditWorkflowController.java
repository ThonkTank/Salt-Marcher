package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.model.DungeonSquarePaint;
import features.world.dungeonmap.ui.canvas.DungeonMapPane;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorControls;
import features.world.dungeonmap.ui.editor.panes.DungeonToolSettingsPane;
import ui.async.UiErrorReporter;

final class DungeonSquareEditWorkflowController {

    private final DungeonEditorState state;
    private final DungeonEditorApplicationService applicationService;
    private final DungeonEditorControls controls;
    private final DungeonToolSettingsPane toolSettingsPane;
    private final DungeonPaintSession paintSession;
    private Runnable reloadCurrentMap = () -> { };

    DungeonSquareEditWorkflowController(
            DungeonEditorState state,
            DungeonEditorApplicationService applicationService,
            DungeonEditorControls controls,
            DungeonToolSettingsPane toolSettingsPane,
            DungeonPaintSession paintSession
    ) {
        this.state = state;
        this.applicationService = applicationService;
        this.controls = controls;
        this.toolSettingsPane = toolSettingsPane;
        this.paintSession = paintSession;
    }

    void setReloadCurrentMap(Runnable reloadCurrentMap) {
        this.reloadCurrentMap = reloadCurrentMap == null ? () -> { } : reloadCurrentMap;
    }

    void handleCellPaint(DungeonMapPane.CellInteraction interaction) {
        DungeonToolBehavior toolBehavior = DungeonToolBehavior.forTool(controls.getActiveTool());
        Long roomId = toolBehavior.fillsSquares() ? toolSettingsPane.getActiveRoomId() : null;
        DungeonSquarePaint edit = new DungeonSquarePaint(interaction.x(), interaction.y(), toolBehavior.fillsSquares(), roomId);
        paintSession.previewPaint(state.currentMapId(), state.currentState(), edit);
    }

    void flushPendingSquareEdits() {
        paintSession.flushPendingPaints(
                state.currentMapId(),
                (mapId, edits) -> applicationService.applySquareEdits(
                        mapId,
                        edits,
                        reloadCurrentMap,
                        ex -> {
                            UiErrorReporter.reportBackgroundFailure("DungeonSquareEditWorkflowController.flushPendingSquareEdits()", ex);
                            reloadCurrentMap.run();
                        }));
    }

    void commitPendingSquareEdits() {
        flushPendingSquareEdits();
    }

    void discardPendingSquareEdits() {
        paintSession.discardPendingPaints();
    }

    boolean hasPendingSquareEdits() {
        return paintSession.hasPendingPaints();
    }
}
