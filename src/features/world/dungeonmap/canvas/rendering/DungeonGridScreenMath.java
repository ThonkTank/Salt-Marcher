package features.world.dungeonmap.canvas.rendering;

import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.corridors.model.CorridorGeometry;
import features.world.dungeonmap.corridors.model.DoorSegment;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.rooms.model.DungeonRoom;
import features.world.dungeonmap.foundation.geometry.Point2i;

import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;

public final class DungeonGridScreenMath {

    private DungeonGridScreenMath() {
    }

    public static Set<CorridorRenderKeys.CorridorSegmentKey> allDoorSegments(
            DungeonLayout layout,
            Function<DungeonCorridor, CorridorGeometry> geometryResolver
    ) {
        Set<CorridorRenderKeys.CorridorSegmentKey> segments = new LinkedHashSet<>();
        if (layout == null) {
            return segments;
        }
        for (DungeonCorridor corridor : layout.corridors()) {
            CorridorGeometry geometry = geometryResolver.apply(corridor);
            if (geometry == null || !geometry.routable()) {
                continue;
            }
            for (DoorSegment door : geometry.doors()) {
                segments.add(CorridorRenderKeys.segmentKey(door.start(), door.end()));
            }
        }
        return segments;
    }

    public static Set<Long> encodeSegments(Set<CorridorRenderKeys.CorridorSegmentKey> segments) {
        Set<Long> encoded = new LinkedHashSet<>();
        for (CorridorRenderKeys.CorridorSegmentKey segment : segments) {
            encoded.add(encodeSegment(segment.start(), segment.end()));
        }
        return encoded;
    }

    public static long encodeCell(Point2i cell) {
        return encodeCell(cell.x(), cell.y());
    }

    public static long encodeCell(int x, int y) {
        return (((long) x) << 32) ^ (y & 0xffffffffL);
    }

    public static long encodeSegment(Point2i a, Point2i b) {
        CorridorRenderKeys.CorridorSegmentKey key = CorridorRenderKeys.segmentKey(a, b);
        return encodeSegment(key.start().x(), key.start().y(), key.end().x(), key.end().y());
    }

    public static long encodeSegment(int x1, int y1, int x2, int y2) {
        boolean ordered = x1 < x2 || (x1 == x2 && y1 <= y2);
        int startX = ordered ? x1 : x2;
        int startY = ordered ? y1 : y2;
        int endX = ordered ? x2 : x1;
        int endY = ordered ? y2 : y1;
        return encodeCell(startX, startY) * 31 + encodeCell(endX, endY);
    }

    public static double distanceToDoor(double screenX, double screenY, DoorSegment door, ScreenPointResolver resolver) {
        return distanceToSegment(
                screenX,
                screenY,
                resolver.screenX(door.start().x()),
                resolver.screenY(door.start().y()),
                resolver.screenX(door.end().x()),
                resolver.screenY(door.end().y()));
    }

    public static double distanceToRoomCell(double screenX, double screenY, Point2i roomCell, ScreenPointResolver resolver) {
        double centerX = resolver.screenX(roomCell.x() + 0.5);
        double centerY = resolver.screenY(roomCell.y() + 0.5);
        return Math.hypot(screenX - centerX, screenY - centerY);
    }

    public static double distanceToSegment(double screenX, double screenY, Point2i from, Point2i to, ScreenPointResolver resolver) {
        return distanceToSegment(
                screenX,
                screenY,
                resolver.screenX(from.x() + 0.5),
                resolver.screenY(from.y() + 0.5),
                resolver.screenX(to.x() + 0.5),
                resolver.screenY(to.y() + 0.5));
    }

    public static double distanceToSegment(double screenX, double screenY, double x1, double y1, double x2, double y2) {
        double dx = x2 - x1;
        double dy = y2 - y1;
        double lengthSquared = dx * dx + dy * dy;
        if (lengthSquared == 0) {
            return Math.hypot(screenX - x1, screenY - y1);
        }
        double t = Math.max(0, Math.min(1, ((screenX - x1) * dx + (screenY - y1) * dy) / lengthSquared));
        double px = x1 + t * dx;
        double py = y1 + t * dy;
        return Math.hypot(screenX - px, screenY - py);
    }

    public static double distanceToInvalidCorridorLink(
            double screenX,
            double screenY,
            CorridorGeometry geometry,
            DungeonLayout layout,
            boolean corridorLinksVisible,
            Function<DungeonRoom, Point2i> roomCenterResolver,
            ScreenPointResolver resolver
    ) {
        InvalidCorridorLink link = invalidCorridorLink(geometry, layout, corridorLinksVisible);
        if (link == null) {
            return Double.POSITIVE_INFINITY;
        }
        Point2i fromCenter = roomCenterResolver.apply(link.from());
        Point2i toCenter = roomCenterResolver.apply(link.to());
        return distanceToSegment(
                screenX,
                screenY,
                resolver.screenX(fromCenter.x() + 0.5),
                resolver.screenY(fromCenter.y() + 0.5),
                resolver.screenX(toCenter.x() + 0.5),
                resolver.screenY(toCenter.y() + 0.5));
    }

    public static InvalidCorridorLink invalidCorridorLink(
            CorridorGeometry geometry,
            DungeonLayout layout,
            boolean corridorLinksVisible
    ) {
        if (!corridorLinksVisible || geometry == null || geometry.roomIds().size() < 2 || layout == null) {
            return null;
        }
        DungeonRoom from = layout.roomById(geometry.roomIds().get(0));
        DungeonRoom to = layout.roomById(geometry.roomIds().get(1));
        return from == null || to == null ? null : new InvalidCorridorLink(from, to);
    }

    public interface ScreenPointResolver {
        double screenX(double worldX);
        double screenY(double worldY);
    }

    public record InvalidCorridorLink(DungeonRoom from, DungeonRoom to) {
        public InvalidCorridorLink {
            Objects.requireNonNull(from, "from");
            Objects.requireNonNull(to, "to");
        }
    }
}
