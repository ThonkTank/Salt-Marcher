package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;

import java.util.Objects;
import java.util.function.Function;

public final class DungeonRuntimeInteractionPolicy {

    public sealed interface RuntimeDecision permits RuntimeDecision.Idle,
            RuntimeDecision.DragStarted,
            RuntimeDecision.DragUpdated,
            RuntimeDecision.MoveCommitted {

        record Idle() implements RuntimeDecision {
        }

        record DragStarted(DungeonDragService.DungeonDragSession session, Point2i previewCell) implements RuntimeDecision {
            public DragStarted {
                Objects.requireNonNull(session, "session");
                Objects.requireNonNull(previewCell, "previewCell");
            }
        }

        record DragUpdated(DungeonDragService.DungeonDragSession session, Point2i previewCell) implements RuntimeDecision {
            public DragUpdated {
                Objects.requireNonNull(session, "session");
                Objects.requireNonNull(previewCell, "previewCell");
            }
        }

        record MoveCommitted(Point2i targetCell) implements RuntimeDecision {
            public MoveCommitted {
                Objects.requireNonNull(targetCell, "targetCell");
            }
        }
    }

    private final DungeonHitService hitService;
    private final DungeonDragService dragService;
    private final DungeonPlacementValidator placementValidator;

    public DungeonRuntimeInteractionPolicy(
            DungeonHitService hitService,
            DungeonDragService dragService,
            DungeonPlacementValidator placementValidator
    ) {
        this.hitService = Objects.requireNonNull(hitService, "hitService");
        this.dragService = Objects.requireNonNull(dragService, "dragService");
        this.placementValidator = Objects.requireNonNull(placementValidator, "placementValidator");
    }

    public RuntimeDecision decidePress(
            DungeonLayout layout,
            DungeonCanvasPointerEvent event,
            DungeonCanvasCamera camera,
            int level,
            Point2i activeTile
    ) {
        if (layout == null || event == null || camera == null || activeTile == null || !activeTile.equals(event.gridCell())) {
            return new RuntimeDecision.Idle();
        }
        DungeonHitService.DungeonHitTarget target = hitService.hitAt(layout, event, level);
        if (!(target instanceof DungeonHitService.DungeonHitTarget.RoomTarget
                || target instanceof DungeonHitService.DungeonHitTarget.CorridorTarget
                || target instanceof DungeonHitService.DungeonHitTarget.StairTarget
                || target instanceof DungeonHitService.DungeonHitTarget.TransitionTarget)) {
            return new RuntimeDecision.Idle();
        }
        DungeonDragService.DungeonDragResult result = dragService.begin(
                event,
                new DungeonDragService.DungeonDragTarget.TileDragTarget(activeTile));
        if (result instanceof DungeonDragService.DungeonDragResult.Started started) {
            return new RuntimeDecision.DragStarted(started.session(), activeTile);
        }
        return new RuntimeDecision.Idle();
    }

    public RuntimeDecision decideDrag(
            DungeonLayout layout,
            DungeonCanvasPointerEvent event,
            DungeonCanvasCamera camera,
            int level,
            DungeonDragService.DungeonDragSession session,
            Function<Point2i, Point2i> nearestTraversableTile
    ) {
        if (layout == null || event == null || camera == null || session == null) {
            return new RuntimeDecision.Idle();
        }
        DungeonDragService.DungeonDragResult result = dragService.update(
                event,
                session,
                nearestTraversableTile);
        if (!(result instanceof DungeonDragService.DungeonDragResult.Updated updated)) {
            return new RuntimeDecision.Idle();
        }
        DungeonDragService.DungeonDragSession nextSession = updated.session();
        if (placementValidator.validateTraversable(layout, nextSession.currentCell(), level)
                instanceof DungeonPlacementValidator.PlacementResult.Valid valid) {
            return new RuntimeDecision.DragUpdated(nextSession, valid.cell());
        }
        return new RuntimeDecision.Idle();
    }

    public RuntimeDecision decideRelease(
            DungeonLayout layout,
            DungeonCanvasPointerEvent event,
            DungeonCanvasCamera camera,
            int level,
            DungeonDragService.DungeonDragSession session,
            Function<Point2i, Point2i> nearestTraversableTile
    ) {
        if (layout == null || event == null || camera == null || session == null) {
            return new RuntimeDecision.Idle();
        }
        DungeonDragService.DungeonDragResult result = dragService.drop(
                event,
                session,
                nearestTraversableTile);
        if (!(result instanceof DungeonDragService.DungeonDragResult.Dropped dropped)) {
            return new RuntimeDecision.Idle();
        }
        Point2i targetCell = dropped.session().currentCell();
        if (placementValidator.validateTraversable(layout, targetCell, level)
                instanceof DungeonPlacementValidator.PlacementResult.Valid valid) {
            return new RuntimeDecision.MoveCommitted(valid.cell());
        }
        return new RuntimeDecision.Idle();
    }
}
