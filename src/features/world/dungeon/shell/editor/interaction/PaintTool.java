package features.world.dungeon.shell.editor.interaction;

import features.world.dungeon.dungeonmap.cluster.application.DungeonClusterApplicationService;
import features.world.dungeon.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeon.dungeonmap.application.DungeonMapLoadingService;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.model.interaction.DungeonSelectionRef;
import features.world.dungeon.state.DungeonEditorTool;
import features.world.dungeon.state.DungeonEditorSessionState;
import features.world.dungeon.dungeonmap.state.DungeonMapState;
import features.world.dungeon.state.EditorInteractionState;
import features.world.dungeon.state.EditorPreview;
import javafx.scene.Node;
import ui.async.UiErrorReporter;

import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Editor tool for room paint and delete gestures.
 *
 * <p>This tool owns paint-window draft semantics and publishes preview cells only. Room mutation rules themselves stay
 * in room workflows.</p>
 */
public final class PaintTool implements EditorTool {

    private final DungeonMapState mapState;
    private final DungeonMapLoadingService loadingService;
    private final DungeonEditorSessionState sessionState;
    private final DungeonClusterApplicationService roomApplicationService;
    private final EditorInteractionState state;

    private CellWindowDragSession paintSession;

    public PaintTool(
            DungeonMapState mapState,
            DungeonMapLoadingService loadingService,
            DungeonEditorSessionState sessionState,
            DungeonClusterApplicationService roomApplicationService,
            EditorInteractionState state
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.loadingService = Objects.requireNonNull(loadingService, "loadingService");
        this.sessionState = Objects.requireNonNull(sessionState, "sessionState");
        this.roomApplicationService = Objects.requireNonNull(roomApplicationService, "roomApplicationService");
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
        GridPoint cell = resolvedCell(ctx);
        if (cell == null || !sessionState.selectedTool().isRoomTool()) {
            clear();
            return false;
        }
        state.clearSelection();
        paintSession = new CellWindowDragSession(cell, cell, sessionState.selectedTool() == DungeonEditorTool.ROOM_DELETE);
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
        GridPoint cell = resolvedCell(ctx);
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
        if (event == null || paintSession == null) {
            return false;
        }
        GridPoint cell = resolvedCell(ctx);
        CellWindowDragSession finishedSession = cell == null ? paintSession : paintSession.withEndCell(cell);
        int activeLevel = mapState.activeProjectionLevel();
        Set<GridPoint> cells = finishedSession.previewCells();
        clear();
        Long mapId = mapState.activeMapId();
        if (mapId == null || cells.isEmpty()) {
            return true;
        }
        loadingService.submitMutation(
                () -> {
                    if (finishedSession.deleteMode()) {
                        roomApplicationService.deleteCells(new DungeonClusterApplicationService.DeleteCellsRequest(
                                mapId,
                                activeLevel,
                                features.world.dungeon.geometry.GridArea.of(cells)));
                    } else {
                        roomApplicationService.paintCells(new DungeonClusterApplicationService.PaintCellsRequest(
                                mapId,
                                activeLevel,
                                features.world.dungeon.geometry.GridArea.of(cells)));
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
    public List<EditorInteractionCapability> interactionCapabilities(EditorToolContext ctx, EditorToolPhase phase) {
        if (ctx == null || !sessionState.selectedTool().isRoomTool() || ctx.probe() == null) {
            return List.of();
        }
        return List.of(EditorCapabilities.partFallback(this::gridCellRef));
    }

    @Override
    public void setRefreshCallback(Runnable callback) {
    }

    private void clear() {
        paintSession = null;
        state.clearPreview();
    }

    private static GridPoint resolvedCell(EditorToolContext ctx) {
        if (ctx == null || ctx.hitRef() == null) {
            return null;
        }
        return switch (ctx.hitRef()) {
            case DungeonSelectionRef.GridCellRef gridCellRef -> gridCellRef.cell();
            default -> null;
        };
    }

    private DungeonSelectionRef gridCellRef(EditorToolContext ctx) {
        if (ctx == null || ctx.probe() == null) {
            return null;
        }
        return new DungeonSelectionRef.GridCellRef(GridPoint.cell(
                ctx.probe().gridCell().x2() / 2,
                ctx.probe().gridCell().y2() / 2,
                ctx.probe().levelZ()));
    }
}
