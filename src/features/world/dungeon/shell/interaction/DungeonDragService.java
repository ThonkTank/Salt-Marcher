package features.world.dungeon.shell.interaction;

import features.world.dungeon.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeon.geometry.GridPoint;

import java.util.Objects;
import java.util.function.Function;

public final class DungeonDragService {

    public sealed interface DungeonDragTarget permits DungeonDragTarget.TileDragTarget {

        GridPoint originCell();

        record TileDragTarget(GridPoint originCell) implements DungeonDragTarget {
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

    public record DungeonDragSession(DungeonDragTarget target, GridPoint currentCell) {
        public DungeonDragSession {
            Objects.requireNonNull(target, "target");
            Objects.requireNonNull(currentCell, "currentCell");
        }

        public DungeonDragSession movedTo(GridPoint nextCell) {
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
            Function<GridPoint, GridPoint> snapTarget
    ) {
        if (event == null || session == null || snapTarget == null) {
            return new DungeonDragResult.Idle();
        }
        GridPoint snapped = snapTarget.apply(event.gridCell());
        if (snapped == null) {
            return new DungeonDragResult.Rejected("Pointer is outside a draggable target.");
        }
        return new DungeonDragResult.Updated(session.movedTo(snapped));
    }

    public DungeonDragResult drop(
            DungeonCanvasPointerEvent event,
            DungeonDragSession session,
            Function<GridPoint, GridPoint> snapTarget
    ) {
        if (event == null || session == null || snapTarget == null) {
            return new DungeonDragResult.Idle();
        }
        GridPoint snapped = snapTarget.apply(event.gridCell());
        if (snapped == null) {
            return new DungeonDragResult.Rejected("Drop target is not traversable.");
        }
        return new DungeonDragResult.Dropped(session.movedTo(snapped));
    }
}
