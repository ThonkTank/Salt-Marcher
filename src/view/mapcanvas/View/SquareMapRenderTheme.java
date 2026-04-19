package src.view.mapcanvas.View;
import javafx.scene.paint.Color;
import javafx.scene.text.Font;
import javafx.scene.text.FontWeight;
import src.view.mapcanvas.api.MapCanvasCell;
final class SquareMapRenderTheme {
    static final Color BACKGROUND = Color.web("#12181c");
    static final Color GRID_MINOR = Color.web("#667782", 0.18);
    static final Color GRID_MEDIUM = Color.web("#738390", 0.16);
    static final Color GRID_MAJOR = Color.web("#8d9ca8", 0.22);
    static final Color GRID_MAX = Color.web("#b1bcc5", 0.28);
    static final Color GRID_AXIS = Color.web("#c5d1d8", 0.32);
    static final Color ROOM_FILL = Color.web("#2a3238");
    static final Color ROOM_STROKE = Color.web("#8a6a35");
    static final Color CORRIDOR_FILL = Color.web("#3b5053", 0.80);
    static final Color CORRIDOR_STROKE = Color.web("#91b6b0");
    static final Color CURRENT_FILL = Color.web("#5b4517");
    static final Color CURRENT_STROKE = Color.web("#fff0c6");
    static final Color OPEN_FILL = Color.web("#303940");
    static final Color OPEN_STROKE = Color.web("#667782");
    static final Color BLOCKED_FILL = Color.web("#2a2f33");
    static final Color BLOCKED_STROKE = Color.web("#555d64");
    static final Color WALL_STROKE = Color.web("#8a6a35");
    static final Color DOOR_STROKE = Color.web("#e5c06f");
    static final Color LABEL_FILL = Color.web("#181f24");
    static final Color LABEL_BORDER = Color.web("#8a6a35");
    static final Color LABEL_TEXT = Color.web("#ecedee");
    static final Color HUD_TEXT = Color.web("#ecedee");
    static final Color PLACEHOLDER = Color.web("#ecedee", 0.92);
    static final Color LOADED_NOTE = Color.web("#ecedee", 0.70);
    static final Font HUD_FONT = Font.font("SansSerif", FontWeight.BOLD, 14);
    static final Font LABEL_FONT = Font.font("SansSerif", FontWeight.BOLD, 12);
    static final Font MARKER_FONT = Font.font("SansSerif", FontWeight.BOLD, 10);
    static final int[] GRID_STEPS = {1, 5, 10, 25};
    private SquareMapRenderTheme() {
    }
    static Color fillFor(MapCanvasCell cell) {
        if (cell.current()) {
            return CURRENT_FILL;
        }
        if (cell.room()) {
            return ROOM_FILL;
        }
        if (cell.corridor()) {
            return CORRIDOR_FILL;
        }
        if (cell.blocked()) {
            return BLOCKED_FILL;
        }
        return OPEN_FILL;
    }
    static Color strokeFor(MapCanvasCell cell) {
        if (cell.current()) {
            return CURRENT_STROKE;
        }
        if (cell.room()) {
            return ROOM_STROKE;
        }
        if (cell.corridor()) {
            return CORRIDOR_STROKE;
        }
        if (cell.blocked()) {
            return BLOCKED_STROKE;
        }
        return OPEN_STROKE;
    }
    static Color gridTierColor(int tier) {
        return switch (tier) {
            case 0 -> GRID_MINOR;
            case 1 -> GRID_MEDIUM;
            case 2 -> GRID_MAJOR;
            default -> GRID_MAX;
        };
    }
    static double gridTierWidth(int tier) {
        return switch (tier) {
            case 0 -> 0.9;
            case 1 -> 1.05;
            case 2 -> 1.4;
            default -> 1.8;
        };
    }
    static int gridStepCount() {
        return GRID_STEPS.length;
    }
    static int gridStep(int index) {
        return GRID_STEPS[index];
    }
    static Color labelBorder(boolean current) {
        return current ? CURRENT_STROKE : LABEL_BORDER;
    }
    static Color currentStroke() {
        return CURRENT_STROKE;
    }
    static Color overlayMessageFill(boolean mapLoaded) {
        return mapLoaded ? LOADED_NOTE : PLACEHOLDER;
    }
}
