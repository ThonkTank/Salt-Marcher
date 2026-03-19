package features.world.quarantine.dungeonmap.canvas.grid;

import features.world.quarantine.dungeonmap.canvas.DungeonCanvasTheme;
import features.world.quarantine.dungeonmap.corridors.model.primitives.DoorSegment;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.foundation.geometry.ScreenPoint;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.paint.Color;

import java.util.List;
import java.util.function.Predicate;

public final class CorridorMarkerRenderer {

    /** Projected screen coordinates for a door segment. */
    public record DoorScreenCoords(double startX, double startY, double endX, double endY) {}

    /** Visual style (radius and fill color) for a door marker. */
    public record DoorMarkerStyle(double radius, Color fill) {}

    /** Screen-space coordinates for a line segment. */
    public record SegmentScreenCoords(double x1, double y1, double x2, double y2) {}

    /** Projects a {@link DoorSegment} to screen coordinates. */
    @FunctionalInterface
    public interface DoorScreenProjection {
        DoorScreenCoords project(DoorSegment door);
    }

    /** Resolves the screen-space center point for a door marker. */
    @FunctionalInterface
    public interface DoorMarkerCenterResolver {
        ScreenPoint center(DoorSegment door);
    }

    /** Resolves the visual style (radius, fill) for a door marker. */
    @FunctionalInterface
    public interface DoorMarkerStyleResolver {
        DoorMarkerStyle resolve(DoorSegment door);
    }

    /** Projects a grid cell ({@link Point2i}) to screen coordinates. */
    @FunctionalInterface
    public interface WaypointScreenProjection {
        ScreenPoint project(Point2i waypoint);
    }

    /** Radius of a door-handle marker when the handle is selected. */
    public static final double DOOR_MARKER_OUTER_RADIUS = DungeonCanvasTheme.Corridor.DOOR_MARKER_OUTER_RADIUS;
    /** Radius of a door-handle marker when the handle is not selected. */
    public static final double DOOR_MARKER_INNER_RADIUS = DungeonCanvasTheme.Corridor.DOOR_MARKER_INNER_RADIUS;
    /** Radius of a waypoint marker. */
    public static final double WAYPOINT_HANDLE_RADIUS = DungeonCanvasTheme.Corridor.WAYPOINT_HANDLE_RADIUS;
    /** Stroke width used for marker outlines. */
    public static final double MARKER_STROKE_WIDTH = 1.5;

    private CorridorMarkerRenderer() {
        throw new AssertionError("No instances");
    }

    /**
     * Draws a filled circle at ({@code cx}, {@code cy}) with radius {@code outerRadius}
     * and an outline stroke circle with radius {@code innerRadius}.
     * <p>
     * Callers typically pass {@link #DOOR_MARKER_OUTER_RADIUS} / {@link #DOOR_MARKER_INNER_RADIUS}
     * (or the same value for both) depending on selection state.
     */
    public static void drawDoorMarker(GraphicsContext gc, double cx, double cy,
            double outerRadius, double innerRadius, Color fill, Color stroke) {
        gc.setFill(fill);
        gc.fillOval(cx - outerRadius, cy - outerRadius, outerRadius * 2, outerRadius * 2);
        gc.setStroke(stroke);
        gc.setLineWidth(MARKER_STROKE_WIDTH);
        gc.strokeOval(cx - innerRadius, cy - innerRadius, innerRadius * 2, innerRadius * 2);
    }

    /**
     * Draws a filled circle (waypoint handle) at ({@code cx}, {@code cy}).
     */
    public static void drawWaypointHandle(GraphicsContext gc, double cx, double cy,
            double radius, Color fill, Color stroke) {
        gc.setFill(fill);
        gc.fillOval(cx - radius, cy - radius, radius * 2, radius * 2);
        gc.setStroke(stroke);
        gc.setLineWidth(MARKER_STROKE_WIDTH);
        gc.strokeOval(cx - radius, cy - radius, radius * 2, radius * 2);
    }

    /**
     * Draws a single styled line segment.
     */
    public static void drawSegmentLine(GraphicsContext gc, double x1, double y1,
            double x2, double y2, double width, Color color) {
        gc.setStroke(color);
        gc.setLineWidth(width);
        gc.strokeLine(x1, y1, x2, y2);
    }

    /**
     * Draws stroke lines for each door in {@code doors}, skipping any door for which
     * {@code skipPredicate} returns {@code true}. Screen coordinates are computed via
     * {@code projection}.
     */
    public static void drawDoorSegments(
            GraphicsContext gc,
            List<DoorSegment> doors,
            long corridorId,
            Predicate<DoorSegment> skipPredicate,
            DoorScreenProjection projection) {
        for (DoorSegment door : doors) {
            if (skipPredicate.test(door)) {
                continue;
            }
            DoorScreenCoords coords = projection.project(door);
            gc.strokeLine(coords.startX(), coords.startY(), coords.endX(), coords.endY());
        }
    }

    /**
     * Draws a waypoint handle for each cell in {@code waypoints}. Screen coordinates are
     * computed via {@code projection}.
     */
    public static void drawWaypointHandles(
            GraphicsContext gc,
            List<Point2i> waypoints,
            WaypointScreenProjection projection,
            double radius,
            Color fill,
            Color stroke) {
        for (Point2i waypoint : waypoints) {
            ScreenPoint pt = projection.project(waypoint);
            drawWaypointHandle(gc, pt.x(), pt.y(), radius, fill, stroke);
        }
    }

    /**
     * Draws a door marker for each door in {@code doors}, skipping any door for which
     * {@code skipPredicate} returns {@code true}. The marker center is resolved via
     * {@code centerResolver} and the visual style via {@code styleResolver}.
     */
    public static void drawDoorMarkers(
            GraphicsContext gc,
            List<DoorSegment> doors,
            Predicate<DoorSegment> skipPredicate,
            DoorMarkerCenterResolver centerResolver,
            DoorMarkerStyleResolver styleResolver) {
        for (DoorSegment door : doors) {
            if (skipPredicate.test(door)) {
                continue;
            }
            ScreenPoint center = centerResolver.center(door);
            DoorMarkerStyle style = styleResolver.resolve(door);
            drawDoorMarker(gc, center.x(), center.y(), style.radius(), style.radius(),
                    style.fill(), DungeonCanvasTheme.Corridor.MARKER_OUTLINE);
        }
    }

    /**
     * Draws styled segment lines for each entry in {@code segments}.
     */
    public static void drawSegmentLines(
            GraphicsContext gc,
            Iterable<SegmentScreenCoords> segments,
            double width,
            Color color) {
        for (SegmentScreenCoords seg : segments) {
            drawSegmentLine(gc, seg.x1(), seg.y1(), seg.x2(), seg.y2(), width, color);
        }
    }
}
