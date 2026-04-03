package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.application.room.DungeonRoomTopologyService;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.loading.DungeonMapLoadingService;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.shell.interaction.DungeonHitSubject;
import features.world.dungeonmap.state.DungeonEditorTool;
import features.world.dungeonmap.state.DungeonEditorSessionState;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.EditorInteractionState;
import features.world.dungeonmap.state.EditorPreview;
import javafx.scene.Node;
import ui.async.UiErrorReporter;

import java.util.Objects;
import java.util.Set;

public final class PaintTool implements EditorTool {

    private final DungeonMapState mapState;
    private final DungeonMapLoadingService loadingService;
    private final DungeonEditorSessionState sessionState;
    private final DungeonRoomTopologyService roomTopologyService;
    private final EditorInteractionState state;

    private RoomPaintSession paintSession;

    public PaintTool(
            DungeonMapState mapState,
            DungeonMapLoadingService loadingService,
            DungeonEditorSessionState sessionState,
            DungeonRoomTopologyService roomTopologyService,
            EditorInteractionState state
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.roomTopologyService = Objects.requireNonNull(roomTopologyService, "roomTopologyService");
        this.state = Objects.requireNonNull(state, "state");
    }

    @Override
    public Set<DungeonEditorTool> supportedTools() {
        return Set.of(DungeonEditorTool.ROOM_PAINT, DungeonEditorTool.ROOM_DELETE);
    }

    @Override
    public void activate(DungeonEditorTool tool) {
    }

    @Override
    public void deactivate() {
        clear();
    }

    @Override
    public boolean pressed(EditorToolContext ctx) {
        DungeonCanvasPointerEvent event = ctx == null ? null : ctx.event();
        if (event == null || !event.isPrimaryButton()) {
            clear();
            return false;
        }
        CellCoord cell = resolvedCell(ctx);
        if (cell == null || !sessionState.selectedTool().isRoomTool()) {
            clear();
            return false;
        }
        state.clearSelection();
        paintSession = new RoomPaintSession(cell, cell, sessionState.selectedTool() == DungeonEditorTool.ROOM_DELETE);
        state.showPreview(new EditorPreview.PaintPreview(
                paintSession.previewCells(),
                mapState.activeProjectionLevel(),
                paintSession.deleteMode()));
        return true;
    }

    @Override
    public boolean dragged(EditorToolContext ctx) {
        DungeonCanvasPointerEvent event = ctx == null ? null : ctx.event();
        if (event == null || !event.isPrimaryButtonDown()) {
            return false;
        }
        CellCoord cell = resolvedCell(ctx);
        if (paintSession == null || cell == null || !sessionState.selectedTool().isRoomTool()) {
            return false;
        }
        if (Objects.equals(paintSession.endCell(), cell)) {
            return true;
        }
        paintSession = paintSession.withEndCell(cell);
        state.showPreview(new EditorPreview.PaintPreview(
                paintSession.previewCells(),
                mapState.activeProjectionLevel(),
                paintSession.deleteMode()));
        return true;
    }

    @Override
    public boolean released(EditorToolContext ctx) {
        DungeonCanvasPointerEvent event = ctx == null ? null : ctx.event();
        if (event == null) {
            return false;
        }
        CellCoord cell = resolvedCell(ctx);
        if (paintSession == null || cell == null) {
            return false;
        }
        RoomPaintSession finishedSession = paintSession.withEndCell(cell);
        int activeLevel = mapState.activeProjectionLevel();
        Set<CellCoord> cells = finishedSession.previewCells();
        clear();
        Long mapId = mapState.activeMapId();
        if (mapId == null || cells.isEmpty()) {
            return true;
        }
        loadingService.submitMutation(
                () -> {
                    if (finishedSession.deleteMode()) {
                        roomTopologyService.deleteCells(mapId, activeLevel, cells);
                    } else {
                        roomTopologyService.paintCells(mapId, activeLevel, cells);
                    }
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> {
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("PaintTool.released()", throwable));
        return true;
    }

    @Override
    public Node statePaneContent() {
        return null;
    }

    @Override
    public EditorHitResolution resolveHit(EditorToolContext ctx, EditorToolPhase phase) {
        if (ctx == null || !sessionState.selectedTool().isRoomTool() || ctx.probe() == null) {
            return EditorHitResolution.none();
        }
        DungeonHitSubject subject = new DungeonHitSubject.FloorCellSubject(ctx.probe().gridCell(), ctx.probe().levelZ());
        return phase == EditorToolPhase.HOVER
                ? EditorHitResolution.none()
                : EditorHitResolution.subjectOnly(subject);
    }

    @Override
    public void setRefreshCallback(Runnable callback) {
    }

    private void clear() {
        paintSession = null;
        state.clearPreview();
    }

    private static CellCoord resolvedCell(EditorToolContext ctx) {
        return ctx != null && ctx.resolvedSubject() instanceof DungeonHitSubject.FloorCellSubject floorCellSubject
                ? floorCellSubject.cell()
                : null;
    }
}
