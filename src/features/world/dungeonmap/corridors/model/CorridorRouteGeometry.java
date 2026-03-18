package features.world.dungeonmap.corridors.model;

import features.world.dungeonmap.foundation.geometry.Point2i;

import java.util.ArrayList;
import java.util.List;

final class CorridorRouteGeometry {

    private enum CardinalDirection {
        EAST(1, 0) {
            @Override DoorSegment doorAt(Point2i cell, long roomId) {
                return new DoorSegment(new Point2i(cell.x() + 1, cell.y()), new Point2i(cell.x() + 1, cell.y() + 1), roomId, cell);
            }
        },
        WEST(-1, 0) {
            @Override DoorSegment doorAt(Point2i cell, long roomId) {
                return new DoorSegment(new Point2i(cell.x(), cell.y()), new Point2i(cell.x(), cell.y() + 1), roomId, cell);
            }
        },
        SOUTH(0, 1) {
            @Override DoorSegment doorAt(Point2i cell, long roomId) {
                return new DoorSegment(new Point2i(cell.x(), cell.y() + 1), new Point2i(cell.x() + 1, cell.y() + 1), roomId, cell);
            }
        },
        NORTH(0, -1) {
            @Override DoorSegment doorAt(Point2i cell, long roomId) {
                return new DoorSegment(new Point2i(cell.x(), cell.y()), new Point2i(cell.x() + 1, cell.y()), roomId, cell);
            }
        };

        final Point2i delta;

        CardinalDirection(int dx, int dy) {
            this.delta = new Point2i(dx, dy);
        }

        abstract DoorSegment doorAt(Point2i cell, long roomId);
    }

    static final List<Point2i> CARDINAL_NEIGHBORS = List.of(
            CardinalDirection.EAST.delta,
            CardinalDirection.WEST.delta,
            CardinalDirection.SOUTH.delta,
            CardinalDirection.NORTH.delta);

    private CorridorRouteGeometry() {
        throw new AssertionError("No instances");
    }

    static Point2i directionForDoor(DoorSegment door) {
        if (door.start().x() == door.end().x()) {
            return door.roomCell().x() < door.start().x()
                    ? CardinalDirection.EAST.delta
                    : CardinalDirection.WEST.delta;
        }
        return door.roomCell().y() < door.start().y()
                ? CardinalDirection.SOUTH.delta
                : CardinalDirection.NORTH.delta;
    }

    static Point2i outsideCellForDoor(DoorSegment door) {
        return door.roomCell().add(directionForDoor(door));
    }

    static DoorSegment doorFor(Point2i cell, Point2i direction, long roomId) {
        for (CardinalDirection d : CardinalDirection.values()) {
            if (d.delta.equals(direction)) {
                return d.doorAt(cell, roomId);
            }
        }
        throw new IllegalArgumentException("Not a cardinal direction: " + direction);
    }

    static List<GridSegment> segmentsForPath(List<Point2i> path) {
        if (path.size() < 2) {
            return List.of();
        }
        List<GridSegment> result = new ArrayList<>();
        for (int i = 1; i < path.size(); i++) {
            result.add(new GridSegment(path.get(i - 1), path.get(i)));
        }
        return List.copyOf(result);
    }

    static boolean sameDoorSegment(DoorSegment left, DoorSegment right) {
        return (left.start().equals(right.start()) && left.end().equals(right.end()))
                || (left.start().equals(right.end()) && left.end().equals(right.start()));
    }
}
