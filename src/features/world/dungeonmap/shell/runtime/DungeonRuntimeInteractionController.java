package features.world.dungeonmap.shell.runtime;

import features.world.dungeonmap.application.runtime.DungeonRuntimeLocation;
import features.world.dungeonmap.canvas.base.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.base.DungeonCanvasInteractionHandler;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.shell.interaction.DungeonDragService;
import features.world.dungeonmap.shell.interaction.DungeonHitService;
import features.world.dungeonmap.shell.interaction.DungeonPlacementValidator;
import features.world.dungeonmap.state.DungeonMapState;
import features.world.dungeonmap.state.DungeonRuntimeState;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;

final class DungeonRuntimeInteractionController implements DungeonCanvasInteractionHandler {

    private final DungeonMapState mapState;
    private final DungeonRuntimeState runtimeState;
    private final Function<Point2i, Point2i> nearestTraversableTile;
    private final Consumer<Point2i> previewHandler;
    private final Consumer<Point2i> moveHandler;
    private final DungeonHitService hitService = new DungeonHitService();
    private final DungeonDragService dragService = new DungeonDragService();
    private final DungeonPlacementValidator placementValidator = new DungeonPlacementValidator();

    private DungeonDragService.DungeonDragSession dragSession;

    DungeonRuntimeInteractionController(
            DungeonMapState mapState,
            DungeonRuntimeState runtimeState,
            Function<Point2i, Point2i> nearestTraversableTile,
            Consumer<Point2i> previewHandler,
            Consumer<Point2i> moveHandler
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.runtimeState = Objects.requireNonNull(runtimeState, "runtimeState");
        this.nearestTraversableTile = Objects.requireNonNull(nearestTraversableTile, "nearestTraversableTile");
        this.previewHandler = Objects.requireNonNull(previewHandler, "previewHandler");
        this.moveHandler = Objects.requireNonNull(moveHandler, "moveHandler");
    }

    @Override
    public boolean handlePressed(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera) {
        if (!interactionEnabled() || event == null) {
            dragSession = null;
            return false;
        }
        Point2i activeTile = activeTile();
        if (activeTile == null || !activeTile.equals(event.gridCell())) {
            dragSession = null;
            return false;
        }
        DungeonHitService.DungeonHitTarget target = hitService.hitAt(projectedLayout(), event, mapState.activeProjectionLevel());
        if (!(target instanceof DungeonHitService.DungeonHitTarget.RoomTarget
                || target instanceof DungeonHitService.DungeonHitTarget.CorridorTarget
                || target instanceof DungeonHitService.DungeonHitTarget.StairTarget
                || target instanceof DungeonHitService.DungeonHitTarget.TransitionTarget)) {
            dragSession = null;
            return false;
        }
        DungeonDragService.DungeonDragResult result = dragService.begin(
                projectedLayout(),
                event,
                camera,
                new DungeonDragService.DungeonDragTarget.TileDragTarget(activeTile));
        if (result instanceof DungeonDragService.DungeonDragResult.Started started) {
            dragSession = started.session();
            previewHandler.accept(activeTile);
            return true;
        }
        dragSession = null;
        return false;
    }

    @Override
    public boolean handleDragged(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera) {
        if (dragSession == null || event == null) {
            return false;
        }
        DungeonDragService.DungeonDragResult result = dragService.update(
                projectedLayout(),
                event,
                camera,
                dragSession,
                nearestTraversableTile);
        if (!(result instanceof DungeonDragService.DungeonDragResult.Updated updated)) {
            return false;
        }
        dragSession = updated.session();
        if (placementValidator.validateTraversable(projectedLayout(), dragSession.currentCell(), camera, mapState.activeProjectionLevel())
                instanceof DungeonPlacementValidator.PlacementResult.Valid valid) {
            previewHandler.accept(valid.cell());
            return true;
        }
        return false;
    }

    @Override
    public boolean handleReleased(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera) {
        if (dragSession == null || event == null) {
            return false;
        }
        DungeonDragService.DungeonDragResult result = dragService.drop(
                projectedLayout(),
                event,
                camera,
                dragSession,
                nearestTraversableTile);
        dragSession = null;
        if (!(result instanceof DungeonDragService.DungeonDragResult.Dropped dropped)) {
            runtimeState.clearDragPreview();
            return false;
        }
        Point2i targetCell = dropped.session().currentCell();
        if (placementValidator.validateTraversable(projectedLayout(), targetCell, camera, mapState.activeProjectionLevel())
                instanceof DungeonPlacementValidator.PlacementResult.Valid valid) {
            moveHandler.accept(valid.cell());
            return true;
        }
        runtimeState.clearDragPreview();
        return false;
    }

    private Point2i activeTile() {
        DungeonRuntimeLocation location = runtimeState.activeLocation();
        return location instanceof DungeonRuntimeLocation.Tile tile ? tile.tile().projectedCell() : null;
    }

    private boolean interactionEnabled() {
        return !mapState.busy() && !runtimeState.loading() && !runtimeState.moving();
    }

    private DungeonLayout projectedLayout() {
        DungeonLayout layout = mapState.activeMap();
        return layout == null ? DungeonLayout.empty() : layout.projectedToLevel(mapState.activeProjectionLevel());
    }
}
