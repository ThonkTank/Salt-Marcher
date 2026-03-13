package features.world.dungeonmap.ui.editor.workflow.paint;

import features.world.dungeonmap.model.editing.DungeonSquarePaint;
import features.world.dungeonmap.model.editing.DungeonWallEdit;
import features.world.dungeonmap.service.DungeonMapCommandService;
import features.world.dungeonmap.ui.canvas.DungeonMapPane;
import features.world.dungeonmap.ui.shared.async.DungeonUiAsyncSupport;
import features.world.dungeonmap.ui.editor.toolbar.DungeonEditorTool;
import features.world.dungeonmap.ui.editor.toolbar.WallEditorMode;
import features.world.dungeonmap.ui.editor.state.DungeonEditorInteractionState;
import features.world.dungeonmap.ui.editor.state.DungeonEditorState;
import ui.async.UiErrorReporter;

import java.util.LinkedHashMap;
import java.util.List;

public final class DungeonSquareEditWorkflow {

    private final DungeonEditorState state;
    private final DungeonEditorInteractionState interactionState;
    private final DungeonMapPane canvas;
    private final DungeonMapCommandService commands;
    private final DungeonPaintSession paintSession;
    private final DungeonWallPaintSession wallPaintSession;
    private final Runnable reloadCurrentMap;

    public DungeonSquareEditWorkflow(
            DungeonEditorState state,
            DungeonEditorInteractionState interactionState,
            DungeonMapPane canvas,
            DungeonMapCommandService commands,
            Runnable reloadCurrentMap
    ) {
        this.state = state;
        this.interactionState = interactionState;
        this.canvas = canvas;
        this.commands = commands;
        this.paintSession = new DungeonPaintSession(canvas::previewPaint);
        this.wallPaintSession = new DungeonWallPaintSession(canvas::previewCommittedWallEdits);
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
                        () -> commands.applySquareEditsAndReconcileState(mapId, edits),
                        reloadCurrentMap,
                        ex -> {
                            UiErrorReporter.reportBackgroundFailure("DungeonSquareEditWorkflow.flushPendingSquareEdits()", ex);
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
                        () -> commands.applyWallEdits(mapId, edits),
                        reloadCurrentMap,
                        ex -> {
                            UiErrorReporter.reportBackgroundFailure("DungeonSquareEditWorkflow.flushPendingWallEdits()", ex);
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
