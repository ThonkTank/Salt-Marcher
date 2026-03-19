package features.world.quarantine.dungeonmap.canvas.grid;

import features.world.quarantine.dungeonmap.canvas.state.CorridorRenderKeys;
import features.world.quarantine.dungeonmap.foundation.geometry.ScreenPoint;
import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorGeometry;
import features.world.quarantine.dungeonmap.corridors.model.primitives.DoorSegment;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;

import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;

public final class DungeonGridScreenMath {

    private DungeonGridScreenMath() {
        throw new AssertionError("No instances");
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

    public static double distanceToDoor(ScreenPoint screen, DoorSegment door, ScreenPointResolver resolver) {
        return distanceToSegment(
                screen,
                resolver.screenX(door.start().x()),
                resolver.screenY(door.start().y()),
                resolver.screenX(door.end().x()),
                resolver.screenY(door.end().y()));
    }

    public static double distanceToRoomCell(ScreenPoint screen, Point2i roomCell, ScreenPointResolver resolver) {
        double centerX = resolver.screenX(roomCell.x() + 0.5);
        double centerY = resolver.screenY(roomCell.y() + 0.5);
        return Math.hypot(screen.x() - centerX, screen.y() - centerY);
    }

    public static double distanceToSegment(ScreenPoint screen, Point2i from, Point2i to, ScreenPointResolver resolver) {
        return distanceToSegment(
                screen,
                resolver.screenX(from.x() + 0.5),
                resolver.screenY(from.y() + 0.5),
                resolver.screenX(to.x() + 0.5),
                resolver.screenY(to.y() + 0.5));
    }

    public static double distanceToSegment(ScreenPoint screen, double x1, double y1, double x2, double y2) {
        double dx = x2 - x1;
        double dy = y2 - y1;
        double lengthSquared = dx * dx + dy * dy;
        if (lengthSquared == 0) {
            return Math.hypot(screen.x() - x1, screen.y() - y1);
        }
        double t = Math.max(0, Math.min(1, ((screen.x() - x1) * dx + (screen.y() - y1) * dy) / lengthSquared));
        double px = x1 + t * dx;
        double py = y1 + t * dy;
        return Math.hypot(screen.x() - px, screen.y() - py);
    }

    public static double distanceToInvalidCorridorLink(
            ScreenPoint screen,
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
                screen,
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
        DungeonRoom from = layout.findRoom(geometry.roomIds().get(0));
        DungeonRoom to = layout.findRoom(geometry.roomIds().get(1));
        return from == null || to == null ? null : new InvalidCorridorLink(from, to);
    }

    public static double projectionT(double px, double py, double x1, double y1, double x2, double y2) {
        double dx = x2 - x1;
        double dy = y2 - y1;
        double lengthSquared = dx * dx + dy * dy;
        if (lengthSquared == 0) {
            return 0.0;
        }
        return Math.max(0.0, Math.min(1.0, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
    }

    public static double squaredDistance(double x1, double y1, double x2, double y2) {
        double dx = x1 - x2;
        double dy = y1 - y2;
        return dx * dx + dy * dy;
    }

    public static double lerp(double start, double end, double t) {
        return start + (end - start) * t;
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
