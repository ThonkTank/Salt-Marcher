package features.world.dungeonmap.model;

public record DoorSegment(
        Point2i start,
        Point2i end,
        long roomId,
        Point2i roomCell
) {
}
