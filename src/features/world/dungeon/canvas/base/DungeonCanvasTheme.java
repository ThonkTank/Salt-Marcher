package features.world.dungeon.canvas.base;

import javafx.geometry.VPos;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.paint.Color;
import javafx.scene.text.Font;
import javafx.scene.text.FontWeight;
import javafx.scene.text.TextAlignment;

public final class DungeonCanvasTheme {

    public static final Color RUNTIME_BACKGROUND = Color.web("#12181c");
    public static final Color EDITOR_BACKGROUND = Color.web("#12181c");
    public static final Color RUNTIME_GRID_MINOR = Color.web("#667782", 0.18);
    public static final Color EDITOR_GRID_MINOR = Color.web("#667782", 0.18);
    public static final Color RUNTIME_GRID_MEDIUM = Color.web("#738390", 0.16);
    public static final Color EDITOR_GRID_MEDIUM = Color.web("#738390", 0.16);
    public static final Color RUNTIME_GRID_MAJOR = Color.web("#8d9ca8", 0.22);
    public static final Color EDITOR_GRID_MAJOR = Color.web("#8d9ca8", 0.22);
    public static final Color RUNTIME_GRID_MAX = Color.web("#b1bcc5", 0.28);
    public static final Color EDITOR_GRID_MAX = Color.web("#b1bcc5", 0.28);
    public static final Color RUNTIME_AXIS = Color.web("#c5d1d8", 0.32);
    public static final Color EDITOR_AXIS = Color.web("#c5d1d8", 0.32);
    public static final Color RUNTIME_TEXT = Color.web("#ecedee");
    public static final Color EDITOR_TEXT = Color.web("#ecedee");
    public static final Color CELL_FILL = Color.web("#2a3238");
    public static final Color CELL_STROKE = Color.web("#8a6a35");
    public static final Color WALL_STROKE = Color.web("#8a6a35");
    public static final Color ROOM_SELECTED_WALL_STROKE = Color.web("#f1d38a");
    public static final Color CORRIDOR_FILL = Color.web("#3b5053", 0.8);
    public static final Color CORRIDOR_STROKE = Color.web("#91b6b0");
    public static final Color CORRIDOR_SELECTED_FILL = Color.web("#58706e", 0.95);
    public static final Color CORRIDOR_SELECTED_STROKE = Color.web("#d7ece7");
    public static final Color DOOR_EDGE_STROKE = Color.web("#e5c06f");
    public static final Color DOOR_EDGE_SELECTED_STROKE = Color.web("#fff1ae");
    public static final Color DOOR_MARKER_FILL = Color.web("#1a2429", 0.96);
    public static final Color DOOR_MARKER_STROKE = Color.web("#e5c06f");
    public static final Color DOOR_MARKER_SELECTED_FILL = Color.web("#314148", 0.98);
    public static final Color DOOR_MARKER_SELECTED_STROKE = Color.web("#fff1ae");
    public static final Color GRAPH_LINK = Color.web("#56636c");
    public static final Color GRAPH_NODE_FILL = Color.web("#2f3a41");
    public static final Color GRAPH_NODE_STROKE = Color.web("#8a6a35");
    public static final Color GRAPH_NODE_TEXT = Color.web("#ecedee");
    public static final Color PARTY_TOKEN_FILL = Color.web("#ffb62a");
    public static final Color PARTY_TOKEN_STROKE = Color.web("#fff0c6");
    public static final Color PARTY_TOKEN_SHADOW = Color.web("#120f08", 0.8);
    public static final Color LABEL_FILL = Color.web("#181f24");
    public static final Color LABEL_BORDER = Color.web("#8a6a35");
    public static final Color LABEL_TEXT = Color.web("#ecedee");
    public static final Color OVERLAY_ABOVE_TINT = Color.web("#7cc8f4");
    public static final Color OVERLAY_BELOW_TINT = Color.web("#d6a565");
    public static final Color PAINT_PREVIEW_FILL = Color.web("#41a9f2", 0.28);
    public static final Color PAINT_PREVIEW_STROKE = Color.web("#7ac9ff");
    public static final Color DELETE_PREVIEW_FILL = Color.web("#c26464", 0.24);
    public static final Color DELETE_PREVIEW_STROKE = Color.web("#f09a9a");
    public static final Color BOUNDARY_PREVIEW_STROKE = Color.web("#7ac9ff");
    public static final Color BOUNDARY_DELETE_PREVIEW_STROKE = Color.web("#f09a9a");
    public static final Color BOUNDARY_SKIPPED_PREVIEW_STROKE = Color.web("#d8d18d");
    public static final Color BOUNDARY_START_VERTEX_FILL = Color.web("#fff0c6");
    public static final Color BOUNDARY_START_VERTEX_STROKE = Color.web("#7ac9ff");
    public static final Color BOUNDARY_CURRENT_VERTEX_FILL = Color.web("#ffe2a6");
    public static final Color BOUNDARY_CURRENT_VERTEX_STROKE = Color.web("#ffb62a");
    public static final Font HUD_FONT = Font.font("SansSerif", FontWeight.BOLD, 14);
    public static final Font ROOM_LABEL_FONT = Font.font("SansSerif", FontWeight.BOLD, 12);
    public static final Font GRAPH_NODE_FONT = Font.font("SansSerif", FontWeight.BOLD, 13);
    public static final double BASE_GRID = 32.0;
    public static final double MIN_ZOOM = 0.1;
    public static final double MAX_ZOOM = 4.0;
    public static final double GRID_MIN_READABLE_SPACING = 10.0;
    public static final double GRID_MINOR_LINE_WIDTH = 0.9;
    public static final double GRID_MEDIUM_LINE_WIDTH = 1.05;
    public static final double GRID_MAJOR_LINE_WIDTH = 1.4;
    public static final double GRID_MAX_LINE_WIDTH = 1.8;
    public static final double AXIS_LINE_WIDTH = 2.6;

    private DungeonCanvasTheme() {
        throw new AssertionError("No instances");
    }

    public static Color background(boolean editorMode) {
        return editorMode ? EDITOR_BACKGROUND : RUNTIME_BACKGROUND;
    }

    public static Color grid(boolean editorMode) {
        return gridTier(editorMode, 0);
    }

    public static Color gridTier(boolean editorMode, int tier) {
        return switch (tier) {
            case 0 -> editorMode ? EDITOR_GRID_MINOR : RUNTIME_GRID_MINOR;
            case 1 -> editorMode ? EDITOR_GRID_MEDIUM : RUNTIME_GRID_MEDIUM;
            case 2 -> editorMode ? EDITOR_GRID_MAJOR : RUNTIME_GRID_MAJOR;
            default -> editorMode ? EDITOR_GRID_MAX : RUNTIME_GRID_MAX;
        };
    }

    public static double gridTierWidth(int tier) {
        return switch (tier) {
            case 0 -> GRID_MINOR_LINE_WIDTH;
            case 1 -> GRID_MEDIUM_LINE_WIDTH;
            case 2 -> GRID_MAJOR_LINE_WIDTH;
            default -> GRID_MAX_LINE_WIDTH;
        };
    }

    public static Color axis(boolean editorMode) {
        return editorMode ? EDITOR_AXIS : RUNTIME_AXIS;
    }

    public static double axisLineWidth() {
        return AXIS_LINE_WIDTH;
    }

    public static Color text(boolean editorMode) {
        return editorMode ? EDITOR_TEXT : RUNTIME_TEXT;
    }

    public static void drawHudLabel(GraphicsContext gc, String text, double x, double y) {
        if (text == null || text.isBlank()) {
            return;
        }
        gc.setFill(LABEL_FILL);
        gc.fillRoundRect(x, y, text.length() * 7.2 + 16, 24, 14, 14);
        gc.setStroke(LABEL_BORDER);
        gc.setLineWidth(1);
        gc.strokeRoundRect(x, y, text.length() * 7.2 + 16, 24, 14, 14);
        gc.setFill(LABEL_TEXT);
        gc.setFont(HUD_FONT);
        gc.setTextAlign(TextAlignment.LEFT);
        gc.setTextBaseline(VPos.TOP);
        gc.fillText(text, x + 8, y + 4);
        gc.setTextBaseline(VPos.BASELINE);
    }
}
