package features.world.dungeonmap.shell.runtime;

import features.world.dungeonmap.application.runtime.DungeonRuntimeLocationTileResolver;
import features.world.dungeonmap.canvas.base.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.base.DungeonCanvasInteractionHandler;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.canvas.base.DungeonCanvasTheme;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.shell.interaction.DungeonDragService;
import features.world.dungeonmap.shell.interaction.DungeonHitCollector;
import features.world.dungeonmap.shell.interaction.DungeonHitProbe;
import features.world.dungeonmap.shell.interaction.DungeonHitSnapshot;
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
    private final DungeonHitCollector hitCollector = new DungeonHitCollector();
    private final DungeonRuntimeSelectionPolicy selectionPolicy = new DungeonRuntimeSelectionPolicy();
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
        RuntimeContextSnapshot snapshot = collect(event, camera);
        if (snapshot == null) {
            dragSession = null;
            return false;
        }
        var decision = selectionPolicy.select(
                DungeonRuntimeSelectionPolicy.RuntimeInteractionPhase.PRESS,
                snapshot.activeMap(),
                event,
                snapshot.hitSnapshot(),
                activeTile(snapshot.activeMap()),
                dragSession);
        if (!decision.dispatchToTool() || !decision.beginDrag()) {
            dragSession = null;
            return false;
        }
        CubePoint activeTile = activeTile(snapshot.activeMap());
        DungeonDragService.DungeonDragResult result = dragService.begin(
                event,
                new DungeonDragService.DungeonDragTarget.TileDragTarget(activeTile.projectedCell()));
        if (result instanceof DungeonDragService.DungeonDragResult.Started started) {
            dragSession = started.session();
            previewHandler.accept(started.session().currentCell());
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
        RuntimeContextSnapshot snapshot = collect(event, camera);
        if (snapshot == null) {
            return false;
        }
        var decision = selectionPolicy.select(
                DungeonRuntimeSelectionPolicy.RuntimeInteractionPhase.DRAG,
                snapshot.activeMap(),
                event,
                snapshot.hitSnapshot(),
                activeTile(snapshot.activeMap()),
                dragSession);
        if (!decision.dispatchToTool()) {
            return false;
        }
        DungeonDragService.DungeonDragResult result = dragService.update(event, dragSession, nearestTraversableTile);
        if (result instanceof DungeonDragService.DungeonDragResult.Updated updated
                && placementValidator.validateTraversable(
                snapshot.activeMap(),
                updated.session().currentCell(),
                snapshot.probe().levelZ()) instanceof DungeonPlacementValidator.PlacementResult.Valid valid) {
            dragSession = updated.session();
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
        RuntimeContextSnapshot snapshot = collect(event, camera);
        DungeonDragService.DungeonDragSession currentSession = dragSession;
        dragSession = null;
        if (snapshot == null) {
            runtimeState.clearDragPreview();
            return false;
        }
        var decision = selectionPolicy.select(
                DungeonRuntimeSelectionPolicy.RuntimeInteractionPhase.RELEASE,
                snapshot.activeMap(),
                event,
                snapshot.hitSnapshot(),
                activeTile(snapshot.activeMap()),
                currentSession);
        if (decision.dispatchToTool()) {
            DungeonDragService.DungeonDragResult result = dragService.drop(event, currentSession, nearestTraversableTile);
            if (result instanceof DungeonDragService.DungeonDragResult.Dropped dropped
                    && placementValidator.validateTraversable(
                    snapshot.activeMap(),
                    dropped.session().currentCell(),
                    snapshot.probe().levelZ()) instanceof DungeonPlacementValidator.PlacementResult.Valid valid) {
                moveHandler.accept(valid.cell());
                return true;
            }
        }
        runtimeState.clearDragPreview();
        return false;
    }

    private RuntimeContextSnapshot collect(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera) {
        if (event == null || event.canvasPoint() == null || event.gridCell() == null || camera == null) {
            return null;
        }
        DungeonLayout layout = mapState.activeMap();
        DungeonLayout activeMap = layout == null ? DungeonLayout.empty() : layout;
        DungeonHitProbe probe = new DungeonHitProbe(
                event.canvasPoint(),
                event.gridCell(),
                mapState.activeProjectionLevel(),
                camera.panX(),
                camera.panY(),
                DungeonCanvasTheme.BASE_GRID * camera.zoom());
        DungeonHitSnapshot hitSnapshot = hitCollector.collect(activeMap, probe);
        return new RuntimeContextSnapshot(activeMap, probe, hitSnapshot);
    }

    private CubePoint activeTile(DungeonLayout activeMap) {
        if (activeMap == null) {
            return null;
        }
        return DungeonRuntimeLocationTileResolver.resolve(activeMap, runtimeState.activeLocation());
    }

    private boolean interactionEnabled() {
        return !mapState.busy() && !runtimeState.loading() && !runtimeState.moving();
    }

    private record RuntimeContextSnapshot(
            DungeonLayout activeMap,
            DungeonHitProbe probe,
            DungeonHitSnapshot hitSnapshot
    ) {
    }
}
