package features.world.dungeonmap.canvas.rendering;

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

    public static final Color BACKGROUND = Color.web("#12181c");
    public static final Color GRID_LINE = Color.web("#2b353c");
    public static final Color CORRIDOR = Color.web("#56636c");
    public static final Color CORRIDOR_ACTIVE = Color.web("#8c7a2b");
    public static final Color CORRIDOR_SELECTED = Color.web("#63c2ff");
    public static final Color DOOR = Color.web("#d7c17e");
    public static final Color DOOR_ACTIVE = Color.web("#f1d879");
    public static final Color DOOR_SELECTED = Color.web("#9bddff");
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
    public static final Color LABEL_FILL = Color.web("#181f24");
    public static final Color LABEL_BORDER = Color.web("#8a6a35");
    public static final Color LABEL_TEXT = Color.web("#ecedee");
    public static final Font LABEL_FONT = Font.font("SansSerif", FontWeight.BOLD, 12);
    public static final Color HANDLE_REMOVE = Color.rgb(191, 77, 77, 0.9);
    public static final Color HANDLE_INSERT = Color.rgb(244, 204, 140, 0.9);
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

    /** Radius of a door-handle marker when the handle is selected. */
    public static final double DOOR_MARKER_OUTER_RADIUS = 5.5;
    /** Radius of a door-handle marker when the handle is not selected. */
    public static final double DOOR_MARKER_INNER_RADIUS = 4.5;
    /** Radius of a waypoint handle marker. */
    public static final double WAYPOINT_HANDLE_RADIUS = 5.5;

    /** Minimum canvas dimension (width and height) for the dungeon viewport. */
    public static final double MIN_VIEWPORT_SIZE = 160.0;

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

    /** Maximum pixel distance for a mouse hit to register on a door segment. */
    public static final double DOOR_HIT_RADIUS_PX = 10;
    /** Maximum pixel distance for a mouse hit to register on a selected waypoint or door handle. */
    public static final double WAYPOINT_HIT_RADIUS_PX = 12;
    /** Maximum pixel distance for a mouse hit to register on an invalid corridor link line or corridor segment. */
    public static final double CORRIDOR_LINK_HIT_RADIUS_PX = 10;

    /** Radius used to draw the cluster anchor circle in grid and graph views. */
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
    /** Squared hit-test radius for vertex selection in grid coordinates (0.85 * 0.85). */
    public static final double VERTEX_HIT_RADIUS_SQ = 0.85 * 0.85;
    /** Graph-view room-outline stroke width when the cluster is selected. */
    public static final double GRAPH_SELECTED_STROKE_WIDTH = 2.5;
    /** Graph-view room-outline stroke width when the cluster is not selected. */
    public static final double GRAPH_DEFAULT_STROKE_WIDTH = 1.5;
    /** Fill opacity for the graph-view room sub-node preview fill. */
    public static final double GRAPH_PREVIEW_FILL_OPACITY = 0.65;

    private static final double LABEL_PADDING_X = 8;
    private static final double LABEL_PADDING_Y = 3;
    private static final double LABEL_GAP = 10;
    private static final double LABEL_ARC = 14;
    private static final int LABEL_CACHE_SIZE = 128;
    private static final Map<String, LabelMetrics> LABEL_METRICS = new LinkedHashMap<>(LABEL_CACHE_SIZE, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, LabelMetrics> eldest) {
            return size() > LABEL_CACHE_SIZE;
        }
    };

    private DungeonCanvasTheme() {
    }

    /** Returns the graph-view group color for the given corridor ID. */
    public static Color graphGroupColorFor(long corridorId) {
        return GRAPH_GROUP_COLORS[(int) Math.floorMod(corridorId, GRAPH_GROUP_COLORS.length)];
    }

    public static Color resolveCorridorFillColor(boolean selected, boolean hovered, boolean active) {
        if (selected) return CORRIDOR_SELECTED.deriveColor(0, 1, 1, 0.30);
        if (hovered) return CORRIDOR_SELECTED.deriveColor(0, 1, 1, 0.22);
        if (active) return CORRIDOR_ACTIVE.deriveColor(0, 1, 1, 0.25);
        return CORRIDOR.deriveColor(0, 1, 1, 0.16);
    }

    public static Color resolveCorridorDoorColor(boolean selected, boolean hovered, boolean active) {
        if (selected) return DOOR_SELECTED;
        if (hovered) return DOOR_SELECTED.deriveColor(0, 1, 1, 0.85);
        if (active) return DOOR_ACTIVE;
        return DOOR;
    }

    public static void paintBackground(GraphicsContext gc, double width, double height) {
        gc.setFill(BACKGROUND);
        gc.fillRect(0, 0, width, height);
    }

    public static void drawCenteredLabel(GraphicsContext gc, String text, double anchorX, double anchorY) {
        if (text == null || text.isBlank()) {
            return;
        }
        LabelMetrics metrics = labelMetrics(text);
        double boxWidth = metrics.textWidth() + LABEL_PADDING_X * 2;
        double boxHeight = metrics.textHeight() + LABEL_PADDING_Y * 2;
        double boxX = anchorX - boxWidth / 2.0;
        double boxY = anchorY - LABEL_GAP - boxHeight;

        gc.setFill(LABEL_FILL);
        gc.fillRoundRect(boxX, boxY, boxWidth, boxHeight, LABEL_ARC, LABEL_ARC);
        gc.setStroke(LABEL_BORDER);
        gc.setLineWidth(1);
        gc.strokeRoundRect(boxX, boxY, boxWidth, boxHeight, LABEL_ARC, LABEL_ARC);

        gc.setFont(LABEL_FONT);
        gc.setTextAlign(TextAlignment.CENTER);
        gc.setTextBaseline(VPos.TOP);
        gc.setFill(LABEL_TEXT);
        gc.fillText(text, anchorX, boxY + LABEL_PADDING_Y);
        gc.setTextAlign(TextAlignment.LEFT);
        gc.setTextBaseline(VPos.BASELINE);
    }

    private static LabelMetrics labelMetrics(String text) {
        return LABEL_METRICS.computeIfAbsent(text, value -> {
            Text helper = new Text(value);
            helper.setFont(LABEL_FONT);
            return new LabelMetrics(
                    Math.ceil(helper.getLayoutBounds().getWidth()),
                    Math.ceil(helper.getLayoutBounds().getHeight()));
        });
    }

    private record LabelMetrics(double textWidth, double textHeight) {
    }
}
