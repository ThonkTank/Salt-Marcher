package features.world.dungeonmap.canvas.rendering;

import javafx.scene.canvas.GraphicsContext;
import javafx.scene.paint.Color;

public final class CorridorMarkerRenderer {

    /** Radius of a door-handle marker when the handle is selected. */
    public static final double DOOR_MARKER_OUTER_RADIUS = DungeonCanvasTheme.DOOR_MARKER_OUTER_RADIUS;
    /** Radius of a door-handle marker when the handle is not selected. */
    public static final double DOOR_MARKER_INNER_RADIUS = DungeonCanvasTheme.DOOR_MARKER_INNER_RADIUS;
    /** Radius of a waypoint marker. */
    public static final double WAYPOINT_HANDLE_RADIUS = DungeonCanvasTheme.WAYPOINT_HANDLE_RADIUS;
    /** Stroke width used for marker outlines. */
    public static final double MARKER_STROKE_WIDTH = 1.5;

    private CorridorMarkerRenderer() {
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
}
