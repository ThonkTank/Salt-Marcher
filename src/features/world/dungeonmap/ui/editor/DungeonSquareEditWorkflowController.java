package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.model.DungeonSquarePaint;
import features.world.dungeonmap.model.DungeonWallEdit;
import features.world.dungeonmap.ui.canvas.DungeonMapPane;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorControls;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorTool;
import features.world.dungeonmap.ui.editor.controls.WallEditorMode;
import features.world.dungeonmap.ui.editor.panes.DungeonToolSettingsPane;
import ui.async.UiErrorReporter;

import java.util.LinkedHashMap;
import java.util.List;

final class DungeonSquareEditWorkflowController {

    private final DungeonEditorState state;
    private final DungeonEditorApplicationService applicationService;
    private final DungeonMapPane canvas;
    private final DungeonEditorControls controls;
    private final DungeonToolSettingsPane toolSettingsPane;
    private final DungeonPaintSession paintSession;
    private final DungeonWallPaintSession wallPaintSession;
    private Runnable reloadCurrentMap = () -> { };

    DungeonSquareEditWorkflowController(
            DungeonEditorState state,
            DungeonEditorApplicationService applicationService,
            DungeonMapPane canvas,
            DungeonEditorControls controls,
            DungeonToolSettingsPane toolSettingsPane,
            DungeonPaintSession paintSession,
            DungeonWallPaintSession wallPaintSession
    ) {
        this.state = state;
        this.applicationService = applicationService;
        this.canvas = canvas;
        this.controls = controls;
        this.toolSettingsPane = toolSettingsPane;
        this.paintSession = paintSession;
        this.wallPaintSession = wallPaintSession;
    }

    void setReloadCurrentMap(Runnable reloadCurrentMap) {
        this.reloadCurrentMap = reloadCurrentMap == null ? () -> { } : reloadCurrentMap;
    }

    void handleCellPaint(DungeonMapPane.CellInteraction interaction) {
        DungeonEditorTool activeTool = controls.getActiveTool() == null ? DungeonEditorTool.SELECT : controls.getActiveTool();
        Long roomId = activeTool.fillsSquares() ? toolSettingsPane.getActiveRoomId() : null;
        DungeonSquarePaint edit = new DungeonSquarePaint(interaction.x(), interaction.y(), activeTool.fillsSquares(), roomId);
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

    void handleEdgePaint(DungeonMapPane.EdgeInteraction interaction) {
        if (interaction == null || state.currentMapId() == null || state.currentState() == null) {
            return;
        }
        WallEditorMode mode = toolSettingsPane.getWallEditorMode();
        if (!mode.erasesWalls()) {
            return;
        }
        wallPaintSession.previewEdit(
                state.currentMapId(),
                state.currentState(),
                new DungeonWallEdit(
                        interaction.x(),
                        interaction.y(),
                        interaction.direction(),
                        mode.paintsWalls()));
    }

    void previewWallPaintPath(List<DungeonMapPane.EdgeInteraction> path) {
        if (state.currentMapId() == null || state.currentState() == null) {
            canvas.clearActiveWallPathPreview();
            return;
        }
        canvas.previewActiveWallPath(toWallEdits(path, true));
    }

    void commitWallPaintPath(List<DungeonMapPane.EdgeInteraction> path) {
        if (state.currentMapId() == null || state.currentState() == null) {
            canvas.clearActiveWallPathPreview();
            return;
        }
        List<DungeonWallEdit> edits = toWallEdits(path, true);
        if (edits.isEmpty()) {
            canvas.clearActiveWallPathPreview();
            return;
        }
        wallPaintSession.previewPathCommit(state.currentMapId(), state.currentState(), edits);
        canvas.clearActiveWallPathPreview();
    }

    void flushPendingWallEdits() {
        canvas.clearActiveWallPathPreview();
        wallPaintSession.flushPendingEdits(
                state.currentMapId(),
                (mapId, edits) -> applicationService.applyWallEdits(
                        mapId,
                        edits,
                        reloadCurrentMap,
                        ex -> {
                            UiErrorReporter.reportBackgroundFailure("DungeonSquareEditWorkflowController.flushPendingWallEdits()", ex);
                            reloadCurrentMap.run();
                        }));
    }

    void commitPendingSquareEdits() {
        flushPendingSquareEdits();
        flushPendingWallEdits();
    }

    void discardPendingSquareEdits() {
        paintSession.discardPendingPaints();
        wallPaintSession.discardPendingEdits();
        canvas.clearActiveWallPathPreview();
    }

    boolean hasPendingSquareEdits() {
        return paintSession.hasPendingPaints() || wallPaintSession.hasPendingEdits();
    }

    void handleMapLoaded() {
        wallPaintSession.discardPendingEdits();
        canvas.clearActiveWallPathPreview();
    }

    private List<DungeonWallEdit> toWallEdits(List<DungeonMapPane.EdgeInteraction> path, boolean wallPresent) {
        if (path == null || path.isEmpty()) {
            return List.of();
        }
        LinkedHashMap<String, DungeonWallEdit> deduped = new LinkedHashMap<>();
        for (DungeonMapPane.EdgeInteraction interaction : path) {
            if (interaction == null) {
                continue;
            }
            DungeonWallEdit edit = new DungeonWallEdit(
                    interaction.x(),
                    interaction.y(),
                    interaction.direction(),
                    wallPresent);
            deduped.put(edit.edgeKey(), edit);
        }
        return List.copyOf(deduped.values());
    }
}
