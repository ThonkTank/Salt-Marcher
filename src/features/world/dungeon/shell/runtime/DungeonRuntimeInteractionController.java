package features.world.dungeon.shell.runtime;

import features.world.dungeon.canvas.base.DungeonCanvasCamera;
import features.world.dungeon.canvas.base.DungeonCanvasInteractionHandler;
import features.world.dungeon.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeon.canvas.base.DungeonCanvasTheme;
import features.world.dungeon.application.runtime.DungeonRuntimeNavigationSnapshot;
import features.world.dungeon.dungoenmap.model.DungeonMap;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.shell.interaction.DungeonDragService;
import features.world.dungeon.shell.interaction.DungeonHitCollector;
import features.world.dungeon.shell.interaction.DungeonHitProbe;
import features.world.dungeon.shell.interaction.DungeonHitSnapshot;
import features.world.dungeon.shell.interaction.DungeonPlacementValidator;
import features.world.dungeon.dungoenmap.state.DungeonMapState;
import features.world.dungeon.state.DungeonRuntimeState;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;

final class DungeonRuntimeInteractionController implements DungeonCanvasInteractionHandler {

    private final DungeonMapState mapState;
    private final DungeonRuntimeState runtimeState;
    private final Function<GridPoint, GridPoint> nearestTraversableCell;
    private final Consumer<DungeonRuntimeNavigationSnapshot> previewHandler;
    private final Consumer<DungeonRuntimeNavigationSnapshot> moveHandler;
    private final DungeonHitCollector hitCollector;
    private final DungeonRuntimeSelectionPolicy selectionPolicy = new DungeonRuntimeSelectionPolicy();
    private final DungeonDragService dragService = new DungeonDragService();
    private final DungeonPlacementValidator placementValidator = new DungeonPlacementValidator();

    private DungeonDragService.DungeonDragSession dragSession;

    DungeonRuntimeInteractionController(
            DungeonMapState mapState,
            DungeonRuntimeState runtimeState,
            Function<GridPoint, GridPoint> nearestTraversableCell,
            Consumer<DungeonRuntimeNavigationSnapshot> previewHandler,
            Consumer<DungeonRuntimeNavigationSnapshot> moveHandler,
            DungeonHitCollector hitCollector
    ) {
        this.mapState = Objects.requireNonNull(mapState, "mapState");
        this.runtimeState = Objects.requireNonNull(runtimeState, "runtimeState");
        this.nearestTraversableCell = Objects.requireNonNull(nearestTraversableCell, "nearestTraversableCell");
        this.previewHandler = Objects.requireNonNull(previewHandler, "previewHandler");
        this.moveHandler = Objects.requireNonNull(moveHandler, "moveHandler");
        this.hitCollector = Objects.requireNonNull(hitCollector, "hitCollector");
    }

    @Override
    public boolean handlePressed(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera) {
        if (!interactionEnabled() || event == null) {
            dragSession = null;
            return false;
        }
        DungeonHitSnapshot hitSnapshot = collect(event, camera);
        if (hitSnapshot == null) {
            dragSession = null;
            return false;
        }
        DungeonMap activeMap = activeMap();
        if (!selectionPolicy.canBeginDrag(activeMap, event, hitSnapshot, runtimeState.activeNavigation())) {
            dragSession = null;
            return false;
        }
        GridPoint activeCell = runtimeState.activeNavigation().cell();
        if (activeCell == null) {
            dragSession = null;
            return false;
        }
        DungeonDragService.DungeonDragResult result = dragService.begin(
                event,
                new DungeonDragService.DungeonDragTarget.TileDragTarget(activeCell));
        if (result instanceof DungeonDragService.DungeonDragResult.Started started) {
            dragSession = started.session();
            previewHandler.accept(navigationAt(started.session().currentCell(), hitSnapshot.probe().levelZ()));
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
        DungeonHitSnapshot hitSnapshot = collect(event, camera);
        if (hitSnapshot == null) {
            return false;
        }
        if (!selectionPolicy.canContinueDrag(event, dragSession)) {
            return false;
        }
        DungeonDragService.DungeonDragResult result = dragService.update(event, dragSession, nearestTraversableCell);
        if (result instanceof DungeonDragService.DungeonDragResult.Updated updated
                && placementValidator.validateTraversable(
                activeMap(),
                updated.session().currentCell(),
                hitSnapshot.probe().levelZ()) instanceof DungeonPlacementValidator.PlacementResult.Valid valid) {
            dragSession = updated.session();
            previewHandler.accept(navigationAt(valid.cell(), hitSnapshot.probe().levelZ()));
            return true;
        }
        return false;
    }

    @Override
    public boolean handleReleased(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera) {
        if (dragSession == null || event == null) {
            return false;
        }
        DungeonHitSnapshot hitSnapshot = collect(event, camera);
        DungeonDragService.DungeonDragSession currentSession = dragSession;
        dragSession = null;
        if (hitSnapshot == null) {
            runtimeState.clearDragPreview();
            return false;
        }
        if (selectionPolicy.canDrop(currentSession)) {
            DungeonDragService.DungeonDragResult result = dragService.drop(event, currentSession, nearestTraversableCell);
            if (result instanceof DungeonDragService.DungeonDragResult.Dropped dropped
                    && placementValidator.validateTraversable(
                    activeMap(),
                    dropped.session().currentCell(),
                    hitSnapshot.probe().levelZ()) instanceof DungeonPlacementValidator.PlacementResult.Valid valid) {
                moveHandler.accept(navigationAt(valid.cell(), hitSnapshot.probe().levelZ()));
                return true;
            }
        }
        runtimeState.clearDragPreview();
        return false;
    }

    private DungeonHitSnapshot collect(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera) {
        if (event == null || event.canvasPoint() == null || event.gridCell() == null || camera == null) {
            return null;
        }
        DungeonMap activeMap = activeMap();
        double gridSize = DungeonCanvasTheme.BASE_GRID * camera.zoom();
        DungeonHitProbe probe = new DungeonHitProbe(
                event.canvasPoint(),
                event.gridCell(),
                DungeonHitProbe.point2xForCanvas(event.canvasPoint(), camera.panX(), camera.panY(), gridSize),
                mapState.activeProjectionLevel(),
                camera.panX(),
                camera.panY(),
                gridSize);
        return hitCollector.collect(activeMap, probe);
    }

    private boolean interactionEnabled() {
        return !mapState.busy() && !runtimeState.loading() && !runtimeState.moving();
    }

    private DungeonMap activeMap() {
        DungeonMap layout = mapState.activeMap();
        return layout == null ? DungeonMap.empty() : layout;
    }

    private DungeonRuntimeNavigationSnapshot navigationAt(GridPoint cell, int levelZ) {
        Long mapId = mapState.activeMapId();
        return new DungeonRuntimeNavigationSnapshot(mapId, cell, levelZ, runtimeState.activeNavigation().heading());
    }
}
