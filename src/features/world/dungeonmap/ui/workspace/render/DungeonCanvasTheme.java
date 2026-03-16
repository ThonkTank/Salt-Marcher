package features.world.dungeonmap.ui.workspace.render;

import javafx.geometry.VPos;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.paint.Color;
import javafx.scene.text.Font;
import javafx.scene.text.FontWeight;
import javafx.scene.text.Text;
import javafx.scene.text.TextAlignment;

import java.util.HashMap;
import java.util.Map;

final class DungeonCanvasTheme {

    static final Color BACKGROUND = Color.web("#12181c");
    static final Color GRID_LINE = Color.web("#2b353c");
    static final Color CORRIDOR = Color.web("#56636c");
    static final Color CORRIDOR_ACTIVE = Color.web("#8c7a2b");
    static final Color CORRIDOR_SELECTED = Color.web("#63c2ff");
    static final Color DOOR = Color.web("#d7c17e");
    static final Color DOOR_ACTIVE = Color.web("#f1d879");
    static final Color DOOR_SELECTED = Color.web("#9bddff");
    static final Color ROOM_FILL = Color.web("#2a3238");
    static final Color ROOM_ACTIVE_FILL = Color.web("#3a3510");
    static final Color ROOM_STROKE = Color.web("#8a6a35");
    static final Color ROOM_SELECTED_STROKE = Color.web("#41a9f2");
    static final Color ROOM_PREVIEW_FILL = Color.web("#41a9f2", 0.28);
    static final Color ROOM_PREVIEW_STROKE = Color.web("#7ac9ff");
    static final Color SELECTION_FILL = Color.web("#41a9f2", 0.16);
    static final Color SELECTION_STROKE = Color.web("#8ed7ff");
    static final Color ROOM_CENTER = Color.web("#ecedee");
    static final Color GRAPH_NODE_FILL = Color.web("#2f3a41");
    static final Color GRAPH_NODE_ACTIVE_FILL = Color.web("#423b12");
    static final Color GRAPH_ROOM_OUTLINE = Color.web("#8a6a35", 0.36);
    static final Color GRAPH_ROOM_OUTLINE_SELECTED = Color.web("#7ac9ff", 0.5);
    static final Color LABEL_FILL = Color.web("#181f24");
    static final Color LABEL_BORDER = Color.web("#8a6a35");
    static final Color LABEL_TEXT = Color.web("#ecedee");
    static final Font LABEL_FONT = Font.font("SansSerif", FontWeight.BOLD, 12);

    private static final double LABEL_PADDING_X = 8;
    private static final double LABEL_PADDING_Y = 3;
    private static final double LABEL_GAP = 10;
    private static final double LABEL_ARC = 14;
    private static final Map<String, LabelMetrics> LABEL_METRICS = new HashMap<>();

    private DungeonCanvasTheme() {
    }

    static void paintBackground(GraphicsContext gc, double width, double height) {
        gc.setFill(BACKGROUND);
        gc.fillRect(0, 0, width, height);
    }

    static void drawCenteredLabel(GraphicsContext gc, String text, double anchorX, double anchorY) {
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
