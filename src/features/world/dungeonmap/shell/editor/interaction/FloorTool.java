package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.map.cluster.application.DungeonClusterApplicationService;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.map.application.DungeonMapLoadingService;
import features.world.dungeonmap.map.model.DungeonLayout;
import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.map.cluster.model.RoomCluster;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.state.DungeonEditorTool;
import features.world.dungeonmap.state.DungeonEditorSessionState;
import features.world.dungeonmap.map.state.DungeonMapState;
import features.world.dungeonmap.state.EditorInteractionState;
import features.world.dungeonmap.state.EditorPreview;
import javafx.scene.Node;
import ui.async.UiErrorReporter;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Editor tool for floor-only paint and delete inside existing room surfaces.
 *
 * <p>The drag-window interaction is shared with paint mode, but this tool is the owner of the extra filtering that
 * keeps previews and commits inside valid room cells on the active level.</p>
 */
public final class FloorTool implements EditorTool {

    private final DungeonMapState mapState;
    private final DungeonMapLoadingService loadingService;
    private final DungeonEditorSessionState sessionState;
    private final DungeonClusterApplicationService roomApplicationService;
    private final EditorInteractionState state;

    private CellWindowDragSession dragSession;

    public FloorTool(
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
        return Set.of(DungeonEditorTool.FLOOR_PAINT, DungeonEditorTool.FLOOR_DELETE);
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
        if (cell == null || !sessionState.selectedTool().isFloorTool()) {
            clear();
            return false;
        }
        state.clearSelection();
        dragSession = new CellWindowDragSession(cell, cell, sessionState.selectedTool() == DungeonEditorTool.FLOOR_DELETE);
        showPreview(ctx == null ? null : ctx.activeMap());
        return true;
    }

    @Override
    public boolean dragged(EditorToolContext ctx) {
        DungeonCanvasPointerEvent event = ctx == null ? null : ctx.event();
        if (event == null || !event.isPrimaryButtonDown()) {
            return false;
        }
        GridPoint cell = resolvedCell(ctx);
        if (dragSession == null || cell == null || !sessionState.selectedTool().isFloorTool()) {
            return false;
        }
        if (Objects.equals(dragSession.endCell(), cell)) {
            return true;
        }
        dragSession = dragSession.withEndCell(cell);
        showPreview(ctx == null ? null : ctx.activeMap());
        return true;
    }

    @Override
    public boolean released(EditorToolContext ctx) {
        DungeonCanvasPointerEvent event = ctx == null ? null : ctx.event();
        GridPoint cell = resolvedCell(ctx);
        if (event == null || dragSession == null) {
            return false;
        }
        CellWindowDragSession finishedSession = cell == null ? dragSession : dragSession.withEndCell(cell);
        int activeLevel = mapState.activeProjectionLevel();
        Set<GridPoint> cells = validRoomCells(ctx == null ? null : ctx.activeMap(), activeLevel, finishedSession.previewCells());
        clear();
        Long mapId = mapState.activeMapId();
        if (mapId == null || cells.isEmpty()) {
            return true;
        }
        loadingService.submitMutation(
                () -> {
                    if (finishedSession.deleteMode()) {
                        roomApplicationService.deleteFloorCells(mapId, activeLevel, features.world.dungeonmap.geometry.GridArea.of(cells));
                    } else {
                        roomApplicationService.addFloorCells(mapId, activeLevel, features.world.dungeonmap.geometry.GridArea.of(cells));
                    }
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> {
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("FloorTool.released()", throwable));
        return true;
    }

    @Override
    public Node statePaneContent() {
        return null;
    }

    @Override
    public List<EditorInteractionCapability> interactionCapabilities(EditorToolContext ctx, EditorToolPhase phase) {
        if (ctx == null || !sessionState.selectedTool().isFloorTool() || ctx.probe() == null) {
            return List.of();
        }
        return List.of(EditorCapabilities.partFallback(this::roomCellRef));
    }

    @Override
    public void setRefreshCallback(Runnable callback) {
    }

    private void clear() {
        dragSession = null;
        state.clearPreview();
    }

    private void showPreview(DungeonLayout layout) {
        if (dragSession == null) {
            state.clearPreview();
            return;
        }
        int activeLevel = mapState.activeProjectionLevel();
        state.showPreview(new EditorPreview.PaintPreview(
                validRoomCells(layout, activeLevel, dragSession.previewCells()),
                activeLevel,
                dragSession.deleteMode()));
    }

    private static GridPoint resolvedCell(EditorToolContext ctx) {
        if (ctx == null || ctx.hitRef() == null) {
            return null;
        }
        return switch (ctx.hitRef()) {
            case DungeonSelectionRef.RoomCellRef roomCellRef -> roomCellRef.cell().touchingCells().center();
            default -> null;
        };
    }

    private DungeonSelectionRef roomCellRef(EditorToolContext ctx) {
        if (ctx == null || ctx.probe() == null) {
            return null;
        }
        DungeonLayout layout = ctx.activeMap();
        int levelZ = ctx.probe().levelZ();
        GridPoint gridCell = ctx.probe().gridCell();
        Room room = roomAtCell(layout, gridCell, levelZ);
        if (room == null || room.roomId() == null) {
            return null;
        }
        return new DungeonSelectionRef.RoomCellRef(room.roomId(), GridPoint.cell(gridCell.cellX(), gridCell.cellY(), levelZ));
    }

    private static Set<GridPoint> validRoomCells(DungeonLayout layout, int levelZ, Set<GridPoint> cells) {
        if (layout == null || cells == null || cells.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<GridPoint> result = new LinkedHashSet<>();
        for (GridPoint cell : cells) {
            if (roomAtCell(layout, cell, levelZ) != null) {
                result.add(cell);
            }
        }
        return result.isEmpty() ? Set.of() : Set.copyOf(result);
    }

    private static Room roomAtCell(DungeonLayout layout, GridPoint cell, int levelZ) {
        RoomCluster cluster = layout == null || cell == null ? null : layout.clusterAtCell(cell, levelZ);
        return cluster == null ? null : cluster.roomTopology().roomAt(cell, levelZ);
    }
}
