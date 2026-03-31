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
import features.world.dungeonmap.shell.interaction.DungeonRuntimeInteractionPolicy;
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
    private final DungeonRuntimeInteractionPolicy interactionPolicy = new DungeonRuntimeInteractionPolicy(
            new DungeonHitService(),
            new DungeonDragService(),
            new DungeonPlacementValidator());

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
        DungeonRuntimeInteractionPolicy.RuntimeDecision decision = interactionPolicy.decidePress(
                projectedLayout(),
                event,
                camera,
                mapState.activeProjectionLevel(),
                activeTile());
        if (decision instanceof DungeonRuntimeInteractionPolicy.RuntimeDecision.DragStarted started) {
            dragSession = started.session();
            previewHandler.accept(started.previewCell());
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
        DungeonRuntimeInteractionPolicy.RuntimeDecision decision = interactionPolicy.decideDrag(
                projectedLayout(),
                event,
                camera,
                mapState.activeProjectionLevel(),
                dragSession,
                nearestTraversableTile);
        if (decision instanceof DungeonRuntimeInteractionPolicy.RuntimeDecision.DragUpdated updated) {
            dragSession = updated.session();
            previewHandler.accept(updated.previewCell());
            return true;
        }
        return false;
    }

    @Override
    public boolean handleReleased(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera) {
        if (dragSession == null || event == null) {
            return false;
        }
        DungeonRuntimeInteractionPolicy.RuntimeDecision decision = interactionPolicy.decideRelease(
                projectedLayout(),
                event,
                camera,
                mapState.activeProjectionLevel(),
                dragSession,
                nearestTraversableTile);
        dragSession = null;
        if (decision instanceof DungeonRuntimeInteractionPolicy.RuntimeDecision.MoveCommitted moveCommitted) {
            moveHandler.accept(moveCommitted.targetCell());
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
