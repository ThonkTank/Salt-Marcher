package features.world.dungeonmap.ui.editor.workflow.editing;

import features.world.dungeonmap.model.DungeonSquarePaint;
import features.world.dungeonmap.model.DungeonWallEdit;
import features.world.dungeonmap.service.DungeonMapEditorService;
import features.world.dungeonmap.ui.canvas.DungeonMapPane;
import features.world.dungeonmap.ui.DungeonUiAsyncSupport;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorTool;
import features.world.dungeonmap.ui.editor.controls.WallEditorMode;
import features.world.dungeonmap.ui.editor.state.DungeonEditorInteractionState;
import features.world.dungeonmap.ui.editor.state.DungeonEditorState;
import ui.async.UiErrorReporter;

import java.util.LinkedHashMap;
import java.util.List;

public final class DungeonSquareEditWorkflowController {

    private final DungeonEditorState state;
    private final DungeonEditorInteractionState interactionState;
    private final DungeonMapPane canvas;
    private final DungeonPaintSession paintSession;
    private final DungeonWallPaintSession wallPaintSession;
    private Runnable reloadCurrentMap = () -> { };

    public DungeonSquareEditWorkflowController(
            DungeonEditorState state,
            DungeonEditorInteractionState interactionState,
            DungeonMapPane canvas
    ) {
        this.state = state;
        this.interactionState = interactionState;
        this.canvas = canvas;
        this.paintSession = new DungeonPaintSession(canvas::previewPaint);
        this.wallPaintSession = new DungeonWallPaintSession(canvas::previewCommittedWallEdits);
    }

    public void setReloadCurrentMap(Runnable reloadCurrentMap) {
        this.reloadCurrentMap = reloadCurrentMap == null ? () -> { } : reloadCurrentMap;
    }

    public void handleCellPaint(DungeonMapPane.CellInteraction interaction) {
        DungeonEditorTool activeTool = interactionState.activeTool() == null ? DungeonEditorTool.SELECT : interactionState.activeTool();
        DungeonSquarePaint edit = new DungeonSquarePaint(interaction.x(), interaction.y(), activeTool.fillsSquares());
        paintSession.previewPaint(state.currentMapId(), state.currentState(), edit);
    }

    public void flushPendingSquareEdits() {
        paintSession.flushPendingPaints(
                state.currentMapId(),
                (mapId, edits) -> DungeonUiAsyncSupport.submitAction(
                        () -> DungeonMapEditorService.applySquareEditsAndReconcileState(mapId, edits),
                        reloadCurrentMap,
                        ex -> {
                            UiErrorReporter.reportBackgroundFailure("DungeonSquareEditWorkflowController.flushPendingSquareEdits()", ex);
                            reloadCurrentMap.run();
                        }));
    }

    public void handleEdgePaint(DungeonMapPane.EdgeInteraction interaction) {
        if (interaction == null || state.currentMapId() == null || state.currentState() == null) {
            return;
        }
        var edge = interaction.edge();
        WallEditorMode mode = interactionState.wallEditorMode();
        if (!mode.erasesWalls()) {
            return;
        }
        wallPaintSession.previewEdit(
                state.currentMapId(),
                state.currentState(),
                new DungeonWallEdit(
                        edge.x(),
                        edge.y(),
                        edge.direction(),
                        mode.paintsWalls()));
    }

    public void previewWallPaintPath(List<DungeonMapPane.EdgeInteraction> path) {
        if (state.currentMapId() == null || state.currentState() == null) {
            canvas.clearActiveWallPathPreview();
            return;
        }
        canvas.previewActiveWallPath(toWallEdits(path, true));
    }

    public void commitWallPaintPath(List<DungeonMapPane.EdgeInteraction> path) {
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

    public void flushPendingWallEdits() {
        canvas.clearActiveWallPathPreview();
        wallPaintSession.flushPendingEdits(
                state.currentMapId(),
                (mapId, edits) -> DungeonUiAsyncSupport.submitAction(
                        () -> DungeonMapEditorService.applyWallEdits(mapId, edits),
                        reloadCurrentMap,
                        ex -> {
                            UiErrorReporter.reportBackgroundFailure("DungeonSquareEditWorkflowController.flushPendingWallEdits()", ex);
                            reloadCurrentMap.run();
                        }));
    }

    public void commitPendingSquareEdits() {
        flushPendingSquareEdits();
        flushPendingWallEdits();
    }

    public void discardPendingSquareEdits() {
        paintSession.discardPendingPaints();
        wallPaintSession.discardPendingEdits();
        canvas.clearActiveWallPathPreview();
    }

    public boolean hasPendingSquareEdits() {
        return paintSession.hasPendingPaints() || wallPaintSession.hasPendingEdits();
    }

    public void handleMapLoaded() {
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
            var edge = interaction.edge();
            if (wallPresent && edge.wallPresent() && !edge.canEraseManualWall()) {
                continue;
            }
            DungeonWallEdit edit = new DungeonWallEdit(
                    edge.x(),
                    edge.y(),
                    edge.direction(),
                    wallPresent);
            deduped.put(edit.edgeKey(), edit);
        }
        return List.copyOf(deduped.values());
    }

}
