package features.world.quarantine.dungeonmap.canvas;

import javafx.geometry.VPos;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.paint.Color;
import javafx.scene.text.Font;
import javafx.scene.text.FontWeight;
import javafx.scene.text.Text;
import javafx.scene.text.TextAlignment;

import java.util.LinkedHashMap;
import java.util.Map;

public final class DungeonCanvasTheme {

    // -------------------------------------------------------------------------
    // Grid line colors
    // -------------------------------------------------------------------------

    /** Grid line and canvas rendering colors. */
    public static final class Grid {
        public static final Color GRID_LINE = Color.web("#2b353c");

        private Grid() {
            throw new AssertionError("No instances");
        }
    }

    // -------------------------------------------------------------------------
    // Corridor and door render colors / dimensions
    // -------------------------------------------------------------------------

    /** Corridor and door rendering colors, line widths, and marker dimensions. */
    public static final class Corridor {
        /** Base corridor area fill color. */
        public static final Color CORRIDOR = Color.web("#56636c");
        /** Corridor fill color when the party is actively traversing it. */
        public static final Color CORRIDOR_ACTIVE = Color.web("#8c7a2b");
        /** Corridor fill/stroke color when selected. */
        public static final Color CORRIDOR_SELECTED = Color.web("#63c2ff");

        /** Door segment color (default). */
        public static final Color DOOR = Color.web("#d7c17e");
        /** Door segment color when the corridor is active. */
        public static final Color DOOR_ACTIVE = Color.web("#f1d879");
        /** Door segment color when the corridor is selected. */
        public static final Color DOOR_SELECTED = Color.web("#9bddff");

        /** Waypoint/segment remove-handle color. */
        public static final Color HANDLE_REMOVE = Color.rgb(191, 77, 77, 0.9);
        /** Waypoint/segment insert-handle color. */
        public static final Color HANDLE_INSERT = Color.rgb(244, 204, 140, 0.9);
        /** Outline color for door and waypoint marker circles. */
        public static final Color MARKER_OUTLINE = Color.rgb(18, 24, 28, 0.95);

        /** Default corridor path line width (graph view, unselected). */
        public static final double CORRIDOR_LINE_WIDTH = 3.0;
        /** Corridor path line width when selected (graph view). */
        public static final double CORRIDOR_SELECTED_LINE_WIDTH = 4.0;
        /** Corridor path line width when hovered/preview (graph view). */
        public static final double CORRIDOR_PREVIEW_LINE_WIDTH = 3.5;

        /** Door line width in the grid view (unselected). */
        public static final double GRID_DOOR_LINE_WIDTH = 6.0;
        /** Door line width in the grid view when the corridor is hovered. */
        public static final double GRID_DOOR_LINE_WIDTH_HOVERED = 6.5;
        /** Door line width in the grid view when the corridor is selected. */
        public static final double GRID_DOOR_LINE_WIDTH_SELECTED = 7.0;

        /** Render radius of a door-handle marker when selected. */
        public static final double DOOR_MARKER_OUTER_RADIUS = 5.5;
        /** Render radius of a door-handle marker when not selected. */
        public static final double DOOR_MARKER_INNER_RADIUS = 4.5;
        /** Render radius of a waypoint handle marker. */
        public static final double WAYPOINT_HANDLE_RADIUS = 5.5;

        /** Radius used to draw the cluster anchor circle. */
        public static final double CLUSTER_ANCHOR_RADIUS = 4.5;
        /** Diameter used to draw the cluster anchor circle (= 2 * CLUSTER_ANCHOR_RADIUS). */
        public static final double CLUSTER_ANCHOR_DIAMETER = 9;
        /** Radius used to draw a room anchor circle in the grid view. */
        public static final double ROOM_ANCHOR_RADIUS = 3.5;
        /** Diameter used to draw a room anchor circle (= 2 * ROOM_ANCHOR_RADIUS). */
        public static final double ROOM_ANCHOR_DIAMETER = 7;
        /** Stroke width for cluster and wall-path vertex anchor circles. */
        public static final double ANCHOR_STROKE_WIDTH = 1.5;
        /** Stroke width for room anchor circles in the editor grid view. */
        public static final double ROOM_ANCHOR_STROKE_WIDTH = 1.2;
        /** Radius used to draw a wall-path vertex anchor circle. */
        public static final double WALL_PATH_VERTEX_RADIUS = 4.5;
        /** Diameter used to draw a wall-path vertex anchor circle (= 2 * WALL_PATH_VERTEX_RADIUS). */
        public static final double WALL_PATH_VERTEX_DIAMETER = 9;

        /** Graph-view room-outline stroke width when the cluster is selected. */
        public static final double GRAPH_SELECTED_STROKE_WIDTH = 2.5;
        /** Graph-view room-outline stroke width when the cluster is not selected. */
        public static final double GRAPH_DEFAULT_STROKE_WIDTH = 1.5;
        /** Fill opacity for the graph-view room sub-node preview fill. */
        public static final double GRAPH_PREVIEW_FILL_OPACITY = 0.65;
        /** Render radius for corridor segment handle circles in the graph view. */
        public static final double GRAPH_SEGMENT_HANDLE_RENDER_RADIUS = 7;

        /** Colors used to visually distinguish corridor groups in the graph view. */
        public static final Color[] GRAPH_GROUP_COLORS = {
                Color.web("#e56b6f"),
                Color.web("#4fb286"),
                Color.web("#6c8cff"),
                Color.web("#f4a259"),
                Color.web("#d17dd7"),
                Color.web("#5cc8d7"),
                Color.web("#d8c15c"),
                Color.web("#e07a5f")
        };

        private Corridor() {
            throw new AssertionError("No instances");
        }
    }

    // -------------------------------------------------------------------------
    // Hit-test radii and thresholds
    // -------------------------------------------------------------------------

    /** Hit-test radii and distance thresholds for mouse interaction. */
    public static final class HitTest {
        /** Maximum pixel distance for a mouse hit to register on a door segment. */
        public static final double DOOR_HIT_RADIUS_PX = 10;
        /** Maximum pixel distance for a mouse hit to register on a selected waypoint or door handle. */
        public static final double WAYPOINT_HIT_RADIUS_PX = 12;
        /** Maximum pixel distance for a mouse hit to register on an invalid corridor link line or corridor segment. */
        public static final double CORRIDOR_LINK_HIT_RADIUS_PX = 10;
        /** Squared hit-test radius for vertex selection in grid coordinates (0.85 * 0.85). */
        public static final double VERTEX_HIT_RADIUS_SQ = 0.85 * 0.85;

        /** Hit-test radius for room sub-nodes in the graph view. */
        public static final double GRAPH_ROOM_SUBNODE_RADIUS = 7;
        /** Hit-test radius for corridor lines in the graph view. */
        public static final double GRAPH_CORRIDOR_HIT_RADIUS = 14;
        /** Hit-test radius for door marker circles in the graph view. */
        public static final double GRAPH_DOOR_MARKER_HIT_RADIUS = 8;
        /** Hit-test radius for selected door handle circles in the graph view. */
        public static final double GRAPH_DOOR_HANDLE_HIT_RADIUS = 9;
        /** Hit-test radius for corridor segment handles in the graph view. */
        public static final double GRAPH_SEGMENT_HIT_RADIUS = 10;

        private HitTest() {
            throw new AssertionError("No instances");
        }
    }

    // -------------------------------------------------------------------------
    // Label / text rendering
    // -------------------------------------------------------------------------

    /** Room label rendering: font, colors, padding, and the draw method. */
    public static final class Label {
        private static final Font FONT = Font.font("SansSerif", FontWeight.BOLD, 12);
        private static final Color FILL = Color.web("#181f24");
        private static final Color BORDER = Color.web("#8a6a35");
        private static final Color TEXT = Color.web("#ecedee");
        private static final double PADDING_X = 8;
        private static final double PADDING_Y = 3;
        private static final double GAP = 10;
        private static final double ARC = 14;
        private static final int CACHE_SIZE = 128;
        private static final Map<String, LabelMetrics> METRICS = new LinkedHashMap<>(CACHE_SIZE, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<String, LabelMetrics> eldest) {
                return size() > CACHE_SIZE;
            }
        };

        private Label() {
            throw new AssertionError("No instances");
        }

        public static void drawCenteredLabel(GraphicsContext gc, String text, double anchorX, double anchorY) {
            if (text == null || text.isBlank()) {
                return;
            }
            LabelMetrics metrics = labelMetrics(text);
            double boxWidth = metrics.textWidth() + PADDING_X * 2;
            double boxHeight = metrics.textHeight() + PADDING_Y * 2;
            double boxX = anchorX - boxWidth / 2.0;
            double boxY = anchorY - GAP - boxHeight;

            gc.setFill(FILL);
            gc.fillRoundRect(boxX, boxY, boxWidth, boxHeight, ARC, ARC);
            gc.setStroke(BORDER);
            gc.setLineWidth(1);
            gc.strokeRoundRect(boxX, boxY, boxWidth, boxHeight, ARC, ARC);

            gc.setFont(FONT);
            gc.setTextAlign(TextAlignment.CENTER);
            gc.setTextBaseline(VPos.TOP);
            gc.setFill(TEXT);
            gc.fillText(text, anchorX, boxY + PADDING_Y);
            gc.setTextAlign(TextAlignment.LEFT);
            gc.setTextBaseline(VPos.BASELINE);
        }

        private static LabelMetrics labelMetrics(String text) {
            return METRICS.computeIfAbsent(text, value -> {
                Text helper = new Text(value);
                helper.setFont(FONT);
                return new LabelMetrics(
                        Math.ceil(helper.getLayoutBounds().getWidth()),
                        Math.ceil(helper.getLayoutBounds().getHeight()));
            });
        }

        private record LabelMetrics(double textWidth, double textHeight) {
        }
    }

    // -------------------------------------------------------------------------
    // Canvas background and shared room / selection colors
    // (used across both grid and graph views, not specific to one subsystem)
    // -------------------------------------------------------------------------

    public static final Color BACKGROUND = Color.web("#12181c");

    public static final Color ROOM_FILL = Color.web("#2a3238");
    public static final Color ROOM_ACTIVE_FILL = Color.web("#3a3510");
    public static final Color ROOM_STROKE = Color.web("#8a6a35");
    public static final Color ROOM_SELECTED_STROKE = Color.web("#41a9f2");
    public static final Color ROOM_PREVIEW_FILL = Color.web("#41a9f2", 0.28);
    public static final Color ROOM_PREVIEW_STROKE = Color.web("#7ac9ff");
    public static final Color SELECTION_FILL = Color.web("#41a9f2", 0.16);
    public static final Color SELECTION_STROKE = Color.web("#8ed7ff");
    public static final Color ROOM_CENTER = Color.web("#ecedee");

    public static final Color GRAPH_NODE_FILL = Color.web("#2f3a41");
    public static final Color GRAPH_NODE_ACTIVE_FILL = Color.web("#423b12");
    public static final Color GRAPH_ROOM_OUTLINE = Color.web("#8a6a35", 0.36);
    public static final Color GRAPH_ROOM_OUTLINE_SELECTED = Color.web("#7ac9ff", 0.5);

    /** Minimum canvas dimension (width and height) for the dungeon viewport. */
    public static final double MIN_VIEWPORT_SIZE = 160.0;

    // -------------------------------------------------------------------------
    // Private constructor
    // -------------------------------------------------------------------------

    private DungeonCanvasTheme() {
        throw new AssertionError("No instances");
    }

    // -------------------------------------------------------------------------
    // Static utility methods
    // -------------------------------------------------------------------------

    /** Returns the graph-view group color for the given corridor ID. */
    public static Color graphGroupColorFor(long corridorId) {
        return Corridor.GRAPH_GROUP_COLORS[(int) Math.floorMod(corridorId, Corridor.GRAPH_GROUP_COLORS.length)];
    }

    public static Color resolveCorridorFillColor(boolean selected, boolean hovered, boolean active) {
        if (selected) return Corridor.CORRIDOR_SELECTED.deriveColor(0, 1, 1, 0.30);
        if (hovered) return Corridor.CORRIDOR_SELECTED.deriveColor(0, 1, 1, 0.22);
        if (active) return Corridor.CORRIDOR_ACTIVE.deriveColor(0, 1, 1, 0.25);
        return Corridor.CORRIDOR.deriveColor(0, 1, 1, 0.16);
    }

    public static Color resolveCorridorDoorColor(boolean selected, boolean hovered, boolean active) {
        if (selected) return Corridor.DOOR_SELECTED;
        if (hovered) return Corridor.DOOR_SELECTED.deriveColor(0, 1, 1, 0.85);
        if (active) return Corridor.DOOR_ACTIVE;
        return Corridor.DOOR;
    }

    public static void paintBackground(GraphicsContext gc, double width, double height) {
        gc.setFill(BACKGROUND);
        gc.fillRect(0, 0, width, height);
    }

}
