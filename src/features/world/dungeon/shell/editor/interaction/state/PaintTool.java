package features.world.dungeon.shell.editor.interaction.state;

import features.world.dungeon.dungeonmap.cluster.application.ApplicationObject;
import features.world.dungeon.dungeonmap.cluster.application.input.ClusterSurfaceRewriteRequest;
import features.world.dungeon.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeon.dungeonmap.DungeonMapObject;
import features.world.dungeon.dungeonmap.input.SubmitMutationInput;
import features.world.dungeon.geometry.GridArea;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.model.interaction.DungeonSelectionRef;
import features.world.dungeon.shell.editor.interaction.input.CellWindowDragSession;
import features.world.dungeon.shell.editor.interaction.input.EditorInteractionCapability;
import features.world.dungeon.shell.editor.interaction.input.EditorTool;
import features.world.dungeon.shell.editor.interaction.input.EditorToolContext;
import features.world.dungeon.shell.editor.interaction.input.EditorToolPhase;
import features.world.dungeon.shell.editor.interaction.tasks.EditorCapabilities;
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
@SuppressWarnings("unused")
public final class PaintTool implements EditorTool {

    private final DungeonMapState mapState;
    private final DungeonMapObject mapObject;
    private final DungeonEditorSessionState sessionState;
    private final ApplicationObject roomApplicationService;
    private final EditorInteractionState state;

    private CellWindowDragSession paintSession;

    public PaintTool(
            DungeonMapState mapState,
            DungeonMapObject mapObject,
            DungeonEditorSessionState sessionState,
            ApplicationObject roomApplicationService,
            EditorInteractionState state
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.mapObject = Objects.requireNonNull(mapObject, "mapObject");
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
                paintSession.cellFootprint(),
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
                paintSession.cellFootprint(),
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
        GridArea cells = finishedSession.cellFootprint();
        clear();
        Long mapId = mapState.activeMapId();
        if (mapId == null || cells.isEmpty()) {
            return true;
        }
        mapObject.submitMutation(new SubmitMutationInput<>(
                () -> {
                    roomApplicationService.rewriteSurface(new ClusterSurfaceRewriteRequest(
                            mapId,
                            activeLevel,
                            cells,
                            finishedSession.deleteMode()
                                    ? ClusterSurfaceRewriteRequest.Mode.DELETE
                                    : ClusterSurfaceRewriteRequest.Mode.PAINT));
                    return mapId;
                },
                updatedMapId -> updatedMapId,
                ignored -> {
                },
                throwable -> UiErrorReporter.reportBackgroundFailure("PaintTool.released()", throwable)));
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
