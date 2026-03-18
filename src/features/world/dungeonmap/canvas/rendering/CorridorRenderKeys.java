package features.world.dungeonmap.canvas.rendering;

import features.world.dungeonmap.corridors.model.DoorSegment;
import features.world.dungeonmap.foundation.geometry.Point2i;

public final class CorridorRenderKeys {

    private CorridorRenderKeys() {
    }

    public static int comparePoints(Point2i left, Point2i right) {
        int byX = Integer.compare(left.x(), right.x());
        if (byX != 0) {
            return byX;
        }
        return Integer.compare(left.y(), right.y());
    }

    public static CorridorSegmentKey segmentKey(Point2i a, Point2i b) {
        if (comparePoints(a, b) <= 0) {
            return new CorridorSegmentKey(a, b);
        }
        return new CorridorSegmentKey(b, a);
    }

    public static CorridorDoorMarkerKey doorMarkerKey(DoorSegment door) {
        Point2i start = door.start();
        Point2i end = door.end();
        if (comparePoints(start, end) <= 0) {
            return new CorridorDoorMarkerKey(start, end, door.roomId());
        }
        return new CorridorDoorMarkerKey(end, start, door.roomId());
    }

    public record CorridorSegmentKey(Point2i start, Point2i end) {
        public boolean touches(CorridorSegmentKey other) {
            return start.equals(other.start())
                    || start.equals(other.end())
                    || end.equals(other.start())
                    || end.equals(other.end());
        }
    }

    public record CorridorDoorMarkerKey(Point2i start, Point2i end, long roomId) {
    }
}
