package src.domain.dungeon.model.core.structure.door;

import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Edge;

public final class DoorBoundaryMaterialization {
    private static final long SINGLE_ROOM_TOUCH = 1L;
    private static final long MULTIPLE_ROOM_TOUCH_THRESHOLD = 1L;

    private final boolean materializesDoor;

    private DoorBoundaryMaterialization(boolean materializesDoor) {
        this.materializesDoor = materializesDoor;
    }

    public static DoorBoundaryMaterialization forEdge(
            @Nullable Edge edge,
            Map<Long, ? extends Iterable<Cell>> cellsByRoom,
            ExistingBoundaryKind existingBoundaryKind
    ) {
        TouchingRooms touchingRooms = touchingRooms(edge, cellsByRoom);
        ExistingBoundaryKind safeBoundaryKind =
                existingBoundaryKind == null ? ExistingBoundaryKind.NONE : existingBoundaryKind;
        return new DoorBoundaryMaterialization(switch (touchingRooms) {
            case NONE -> false;
            case ONE -> safeBoundaryKind != ExistingBoundaryKind.DOOR;
            case MULTIPLE -> safeBoundaryKind == ExistingBoundaryKind.NON_DOOR;
        });
    }

    public boolean materializesDoor() {
        return materializesDoor;
    }

    private static TouchingRooms touchingRooms(
            @Nullable Edge edge,
            Map<Long, ? extends Iterable<Cell>> cellsByRoom
    ) {
        if (edge == null || cellsByRoom == null || cellsByRoom.isEmpty()) {
            return TouchingRooms.NONE;
        }
        Set<Cell> touchingCells = Set.copyOf(edge.touchingCells());
        if (touchingCells.isEmpty()) {
            return TouchingRooms.NONE;
        }
        long roomCount = 0L;
        for (Iterable<Cell> roomCells : cellsByRoom.values()) {
            if (touchesRoom(roomCells, touchingCells)) {
                roomCount += 1L;
                if (roomCount > MULTIPLE_ROOM_TOUCH_THRESHOLD) {
                    return TouchingRooms.MULTIPLE;
                }
            }
        }
        return roomCount == SINGLE_ROOM_TOUCH ? TouchingRooms.ONE : TouchingRooms.NONE;
    }

    private static boolean touchesRoom(
            @Nullable Iterable<Cell> roomCells,
            Set<Cell> touchingCells
    ) {
        if (roomCells == null || touchingCells.isEmpty()) {
            return false;
        }
        for (Cell cell : roomCells) {
            if (cell != null && touchingCells.contains(cell)) {
                return true;
            }
        }
        return false;
    }

    public enum ExistingBoundaryKind {
        NONE,
        NON_DOOR,
        DOOR
    }

    private enum TouchingRooms {
        NONE,
        ONE,
        MULTIPLE
    }
}
