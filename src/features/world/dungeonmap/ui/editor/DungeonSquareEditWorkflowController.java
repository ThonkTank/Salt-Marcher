package features.world.dungeonmap.ui.editor;

import features.world.dungeonmap.model.DungeonSquarePaint;
import features.world.dungeonmap.model.DungeonSquare;
import features.world.dungeonmap.model.DungeonWallEdit;
import features.world.dungeonmap.ui.canvas.DungeonMapPane;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorControls;
import features.world.dungeonmap.ui.editor.controls.DungeonEditorTool;
import features.world.dungeonmap.ui.editor.controls.WallEditorMode;
import features.world.dungeonmap.ui.editor.panes.DungeonToolSettingsPane;
import ui.async.UiErrorReporter;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.LinkedHashSet;
import java.util.Set;

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
        DungeonSquarePaint edit = new DungeonSquarePaint(interaction.x(), interaction.y(), activeTool.fillsSquares());
        paintSession.previewPaint(state.currentMapId(), state.currentState(), edit);
    }

    void flushPendingSquareEdits() {
        paintSession.flushPendingPaints(
                state.currentMapId(),
                (mapId, edits) -> applicationService.applySquareEdits(
                        mapId,
                        edits,
                        preferredPrimaryRoomsForSquareEdits(edits),
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
                        preferredPrimaryRoomsForWallEdits(edits),
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

    private List<Long> preferredPrimaryRoomsForSquareEdits(List<DungeonSquarePaint> edits) {
        if (state.currentState() == null || edits == null || edits.isEmpty()) {
            return List.of();
        }
        Set<Long> roomIds = new LinkedHashSet<>();
        for (DungeonSquarePaint edit : edits) {
            DungeonSquare square = findSquare(edit.x(), edit.y());
            if (square != null && square.roomId() != null) {
                roomIds.add(square.roomId());
            }
            addAdjacentRoomIds(roomIds, edit.x(), edit.y());
        }
        return List.copyOf(roomIds);
    }

    private List<Long> preferredPrimaryRoomsForWallEdits(List<DungeonWallEdit> edits) {
        if (state.currentState() == null || edits == null || edits.isEmpty()) {
            return List.of();
        }
        Set<Long> roomIds = new LinkedHashSet<>();
        for (DungeonWallEdit edit : edits) {
            addRoomId(roomIds, findSquare(edit.x(), edit.y()));
            if (edit.direction() == features.world.dungeonmap.model.PassageDirection.EAST) {
                addRoomId(roomIds, findSquare(edit.x() + 1, edit.y()));
            } else {
                addRoomId(roomIds, findSquare(edit.x(), edit.y() + 1));
            }
        }
        return List.copyOf(roomIds);
    }

    private void addAdjacentRoomIds(Set<Long> roomIds, int x, int y) {
        addRoomId(roomIds, findSquare(x - 1, y));
        addRoomId(roomIds, findSquare(x, y - 1));
        addRoomId(roomIds, findSquare(x + 1, y));
        addRoomId(roomIds, findSquare(x, y + 1));
    }

    private void addRoomId(Set<Long> roomIds, DungeonSquare square) {
        if (square != null && square.roomId() != null) {
            roomIds.add(square.roomId());
        }
    }

    private DungeonSquare findSquare(int x, int y) {
        if (state.currentState() == null) {
            return null;
        }
        for (DungeonSquare square : state.currentState().squares()) {
            if (square.x() == x && square.y() == y) {
                return square;
            }
        }
        return null;
    }
}
