package features.world.dungeonmap.shell.runtime;

import features.world.dungeonmap.application.runtime.DungeonRuntimeLocation;
import features.world.dungeonmap.canvas.base.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.base.DungeonCanvasInteractionHandler;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.model.geometry.Point2i;
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

    private boolean dragging;

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
            dragging = false;
            return false;
        }
        Point2i activeTile = activeTile();
        if (activeTile == null || !activeTile.equals(event.gridCell())) {
            dragging = false;
            return false;
        }
        dragging = true;
        previewHandler.accept(activeTile);
        return true;
    }

    @Override
    public boolean handleDragged(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera) {
        if (!dragging || event == null) {
            return false;
        }
        Point2i nearest = nearestTraversableTile.apply(event.gridCell());
        if (nearest == null) {
            return false;
        }
        previewHandler.accept(nearest);
        return true;
    }

    @Override
    public boolean handleReleased(DungeonCanvasPointerEvent event, DungeonCanvasCamera camera) {
        if (!dragging || event == null) {
            return false;
        }
        dragging = false;
        Point2i nearest = nearestTraversableTile.apply(event.gridCell());
        if (nearest == null) {
            runtimeState.clearDragPreview();
            return false;
        }
        moveHandler.accept(nearest);
        return true;
    }

    @Override
    public boolean handleLevelScroll(int levelDelta) {
        if (!interactionEnabled() || levelDelta == 0) {
            return false;
        }
        mapState.setReachableProjectionLevel(mapState.activeProjectionLevel() + levelDelta);
        return true;
    }

    private Point2i activeTile() {
        DungeonRuntimeLocation location = runtimeState.activeLocation();
        return location instanceof DungeonRuntimeLocation.Tile tile ? tile.tile().projectedCell() : null;
    }

    private boolean interactionEnabled() {
        return !mapState.loading() && !runtimeState.loading() && !runtimeState.moving();
    }
}
