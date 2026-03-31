package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.model.geometry.Point2i;

import java.util.Objects;
import java.util.function.Function;

public final class DungeonDragService {

    public sealed interface DungeonDragTarget permits DungeonDragTarget.TileDragTarget {

        Point2i originCell();

        record TileDragTarget(Point2i originCell) implements DungeonDragTarget {
            public TileDragTarget {
                Objects.requireNonNull(originCell, "originCell");
            }
        }
    }

    public sealed interface DungeonDragResult permits DungeonDragResult.Started,
            DungeonDragResult.Updated,
            DungeonDragResult.Dropped,
            DungeonDragResult.Rejected,
            DungeonDragResult.Idle {

        record Started(DungeonDragSession session) implements DungeonDragResult {
        }

        record Updated(DungeonDragSession session) implements DungeonDragResult {
        }

        record Dropped(DungeonDragSession session) implements DungeonDragResult {
        }

        record Rejected(String reason) implements DungeonDragResult {
            public Rejected {
                Objects.requireNonNull(reason, "reason");
            }
        }

        record Idle() implements DungeonDragResult {
        }
    }

    public record DungeonDragSession(DungeonDragTarget target, Point2i currentCell) {
        public DungeonDragSession {
            Objects.requireNonNull(target, "target");
            Objects.requireNonNull(currentCell, "currentCell");
        }

        public DungeonDragSession movedTo(Point2i nextCell) {
            Objects.requireNonNull(nextCell, "nextCell");
            return nextCell.equals(currentCell) ? this : new DungeonDragSession(target, nextCell);
        }
    }

    public DungeonDragResult begin(
            DungeonCanvasPointerEvent event,
            DungeonDragTarget target
    ) {
        if (event == null || target == null) {
            return new DungeonDragResult.Idle();
        }
        if (!event.isPrimaryButton()) {
            return new DungeonDragResult.Rejected("Drag requires the primary button.");
        }
        if (!target.originCell().equals(event.gridCell())) {
            return new DungeonDragResult.Rejected("Pointer must start on the drag origin.");
        }
        return new DungeonDragResult.Started(new DungeonDragSession(target, target.originCell()));
    }

    public DungeonDragResult update(
            DungeonCanvasPointerEvent event,
            DungeonDragSession session,
            Function<Point2i, Point2i> snapTarget
    ) {
        if (event == null || session == null || snapTarget == null) {
            return new DungeonDragResult.Idle();
        }
        Point2i snapped = snapTarget.apply(event.gridCell());
        if (snapped == null) {
            return new DungeonDragResult.Rejected("Pointer is outside a draggable target.");
        }
        return new DungeonDragResult.Updated(session.movedTo(snapped));
    }

    public DungeonDragResult drop(
            DungeonCanvasPointerEvent event,
            DungeonDragSession session,
            Function<Point2i, Point2i> snapTarget
    ) {
        if (event == null || session == null || snapTarget == null) {
            return new DungeonDragResult.Idle();
        }
        Point2i snapped = snapTarget.apply(event.gridCell());
        if (snapped == null) {
            return new DungeonDragResult.Rejected("Drop target is not traversable.");
        }
        return new DungeonDragResult.Dropped(session.movedTo(snapped));
    }
}
