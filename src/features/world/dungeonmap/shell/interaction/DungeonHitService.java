package features.world.dungeonmap.shell.interaction;

import features.world.dungeonmap.canvas.base.DungeonCanvasCamera;
import features.world.dungeonmap.canvas.base.DungeonCanvasPointerEvent;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;

import java.util.Comparator;
import java.util.Objects;

public final class DungeonHitService {

    public sealed interface DungeonHitTarget permits DungeonHitTarget.TransitionTarget,
            DungeonHitTarget.StairTarget,
            DungeonHitTarget.RoomTarget,
            DungeonHitTarget.CorridorTarget,
            DungeonHitTarget.EmptyCellTarget {

        Point2i cell();

        record TransitionTarget(Point2i cell, int level, DungeonTransition transition) implements DungeonHitTarget {
            public TransitionTarget {
                Objects.requireNonNull(cell, "cell");
                Objects.requireNonNull(transition, "transition");
            }
        }

        record StairTarget(Point2i cell, int level, DungeonStair stair) implements DungeonHitTarget {
            public StairTarget {
                Objects.requireNonNull(cell, "cell");
                Objects.requireNonNull(stair, "stair");
            }
        }

        record RoomTarget(Point2i cell, Room room) implements DungeonHitTarget {
            public RoomTarget {
                Objects.requireNonNull(cell, "cell");
                Objects.requireNonNull(room, "room");
            }
        }

        record CorridorTarget(Point2i cell, int level, Corridor corridor) implements DungeonHitTarget {
            public CorridorTarget {
                Objects.requireNonNull(cell, "cell");
                Objects.requireNonNull(corridor, "corridor");
            }
        }

        record EmptyCellTarget(Point2i cell) implements DungeonHitTarget {
            public EmptyCellTarget {
                Objects.requireNonNull(cell, "cell");
            }
        }
    }

    public DungeonHitTarget hitAt(DungeonLayout layout, DungeonCanvasPointerEvent event, int level) {
        if (event == null) {
            return null;
        }
        return hitAt(layout, event.gridCell(), event.camera(), level);
    }

    public DungeonHitTarget hitAt(DungeonLayout layout, Point2i cell, DungeonCanvasCamera camera, int level) {
        if (layout == null || cell == null || camera == null) {
            return null;
        }

        DungeonTransition transition = layout.transitionsAtCell(cell, level).stream()
                .filter(candidate -> candidate != null && candidate.transitionId() != null)
                .min(Comparator.comparing(DungeonTransition::transitionId))
                .orElse(null);
        if (transition != null) {
            return new DungeonHitTarget.TransitionTarget(cell, level, transition);
        }

        DungeonStair stair = layout.stairsAtCell(cell, level).stream()
                .filter(candidate -> candidate != null && candidate.stairId() != null)
                .min(Comparator.comparing(DungeonStair::stairId))
                .orElse(null);
        if (stair != null) {
            return new DungeonHitTarget.StairTarget(cell, level, stair);
        }

        Room room = layout.roomAtCell(cell);
        if (room != null && room.roomId() != null) {
            return new DungeonHitTarget.RoomTarget(cell, room);
        }

        Corridor corridor = layout.corridorsAtCell(cell, level).stream()
                .filter(candidate -> candidate != null && candidate.corridorId() != null)
                .min(Comparator.comparing(Corridor::corridorId))
                .orElse(null);
        if (corridor != null) {
            return new DungeonHitTarget.CorridorTarget(cell, level, corridor);
        }

        return new DungeonHitTarget.EmptyCellTarget(cell);
    }
}
