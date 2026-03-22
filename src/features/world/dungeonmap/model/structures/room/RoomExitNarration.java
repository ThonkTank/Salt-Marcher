package features.world.dungeonmap.model.structures.room;

import features.world.dungeonmap.model.geometry.Point2i;

public record RoomExitNarration(
        Point2i roomCell,
        Point2i direction,
        String description
) {
    public RoomExitNarration {
        roomCell = roomCell == null ? new Point2i(0, 0) : roomCell;
        direction = normalizeDirection(direction);
        description = description == null ? "" : description.trim();
    }

    private static Point2i normalizeDirection(Point2i direction) {
        if (direction == null) {
            return new Point2i(0, -1);
        }
        return switch (direction.x() + "," + direction.y()) {
            case "0,-1", "1,0", "0,1", "-1,0" -> direction;
            default -> throw new IllegalArgumentException("Richtung ist keine Kardinalrichtung: " + direction);
        };
    }
}
