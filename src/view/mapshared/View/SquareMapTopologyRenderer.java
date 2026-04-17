package src.view.mapshared.View;

import javafx.geometry.VPos;
import javafx.scene.canvas.Canvas;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.paint.Color;
import javafx.scene.text.Font;
import javafx.scene.text.FontWeight;
import javafx.scene.text.TextAlignment;
import src.view.mapshared.Controller.MapCameraController;
import src.view.mapshared.Model.MapCellViewModel;
import src.view.mapshared.Model.MapEdgeViewModel;
import src.view.mapshared.Model.MapViewport;
import src.view.mapshared.Model.MapWorkspaceRenderModel;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Canvas renderer aligned with the original Salt Marcher dungeon presentation.
 */
final class SquareMapTopologyRenderer implements MapTopologyRenderer {

    private static final Color BACKGROUND = Color.web("#12181c");
    private static final Color GRID_MINOR = Color.web("#667782", 0.18);
    private static final Color GRID_MEDIUM = Color.web("#738390", 0.16);
    private static final Color GRID_MAJOR = Color.web("#8d9ca8", 0.22);
    private static final Color GRID_MAX = Color.web("#b1bcc5", 0.28);
    private static final Color GRID_AXIS = Color.web("#c5d1d8", 0.32);
    private static final Color ROOM_FILL = Color.web("#2a3238");
    private static final Color ROOM_STROKE = Color.web("#8a6a35");
    private static final Color CORRIDOR_FILL = Color.web("#3b5053", 0.80);
    private static final Color CORRIDOR_STROKE = Color.web("#91b6b0");
    private static final Color CURRENT_FILL = Color.web("#5b4517");
    private static final Color CURRENT_STROKE = Color.web("#fff0c6");
    private static final Color OPEN_FILL = Color.web("#303940");
    private static final Color OPEN_STROKE = Color.web("#667782");
    private static final Color BLOCKED_FILL = Color.web("#2a2f33");
    private static final Color BLOCKED_STROKE = Color.web("#555d64");
    private static final Color WALL_STROKE = Color.web("#8a6a35");
    private static final Color DOOR_STROKE = Color.web("#e5c06f");
    private static final Color LABEL_FILL = Color.web("#181f24");
    private static final Color LABEL_BORDER = Color.web("#8a6a35");
    private static final Color LABEL_TEXT = Color.web("#ecedee");
    private static final Color HUD_TEXT = Color.web("#ecedee");
    private static final Color PLACEHOLDER = Color.web("#ecedee", 0.92);
    private static final Color LOADED_NOTE = Color.web("#ecedee", 0.70);
    private static final Font HUD_FONT = Font.font("SansSerif", FontWeight.BOLD, 14);
    private static final Font LABEL_FONT = Font.font("SansSerif", FontWeight.BOLD, 12);
    private static final Font MARKER_FONT = Font.font("SansSerif", FontWeight.BOLD, 10);
    private static final int[] GRID_STEPS = {1, 5, 10, 25};

    @Override
    public Canvas createCanvas() {
        Canvas canvas = new Canvas(MapViewport.defaultViewport().canvasWidth(), MapViewport.defaultViewport().canvasHeight());
        canvas.getStyleClass().add("dungeon-map-scene");
        return canvas;
    }

    @Override
    public void render(Canvas canvas, MapWorkspaceRenderModel renderModel, MapViewport viewport) {
        canvas.setWidth(viewport.canvasWidth());
        canvas.setHeight(viewport.canvasHeight());
        paint(canvas.getGraphicsContext2D(), renderModel, viewport);
    }

    private void paint(GraphicsContext graphics, MapWorkspaceRenderModel renderModel, MapViewport viewport) {
        graphics.setFill(BACKGROUND);
        graphics.fillRect(0.0, 0.0, viewport.canvasWidth(), viewport.canvasHeight());
        paintGrid(graphics, viewport);
        paintCells(graphics, renderModel, viewport);
        paintEdges(graphics, renderModel, viewport);
        paintLabels(graphics, renderModel, viewport);
        paintHud(graphics, viewport);
        paintOverlayMessage(graphics, renderModel, viewport);
    }

    private void paintGrid(GraphicsContext graphics, MapViewport viewport) {
        double scale = MapCameraController.BASE_TILE_PIXELS * viewport.zoom();
        for (int index = 0; index < GRID_STEPS.length; index++) {
            double pixelSpacing = scale * GRID_STEPS[index];
            if (pixelSpacing < 10.0) {
                continue;
            }
            paintGridTier(graphics, viewport, scale, GRID_STEPS[index], index);
        }
        paintAxis(graphics, viewport, scale);
    }

    private void paintGridTier(GraphicsContext graphics, MapViewport viewport, double scale, int spacingSquares, int tier) {
        int minColumn = (int) Math.floor(viewport.centerX() - viewport.canvasWidth() / (2.0 * scale)) - spacingSquares;
        int maxColumn = (int) Math.ceil(viewport.centerX() + viewport.canvasWidth() / (2.0 * scale)) + spacingSquares;
        int minRow = (int) Math.floor(viewport.centerY() - viewport.canvasHeight() / (2.0 * scale)) - spacingSquares;
        int maxRow = (int) Math.ceil(viewport.centerY() + viewport.canvasHeight() / (2.0 * scale)) + spacingSquares;

        graphics.setStroke(gridTierColor(tier));
        graphics.setLineWidth(gridTierWidth(tier));
        for (int column = align(minColumn, spacingSquares); column <= maxColumn; column += spacingSquares) {
            if (column == 0) {
                continue;
            }
            double x = worldToScreenX(column, viewport, scale);
            graphics.strokeLine(x, 0.0, x, viewport.canvasHeight());
        }
        for (int row = align(minRow, spacingSquares); row <= maxRow; row += spacingSquares) {
            if (row == 0) {
                continue;
            }
            double y = worldToScreenY(row, viewport, scale);
            graphics.strokeLine(0.0, y, viewport.canvasWidth(), y);
        }
    }

    private void paintAxis(GraphicsContext graphics, MapViewport viewport, double scale) {
        graphics.setStroke(GRID_AXIS);
        graphics.setLineWidth(2.6);
        double axisX = worldToScreenX(0.0, viewport, scale);
        double axisY = worldToScreenY(0.0, viewport, scale);
        if (axisX >= 0.0 && axisX <= viewport.canvasWidth()) {
            graphics.strokeLine(axisX, 0.0, axisX, viewport.canvasHeight());
        }
        if (axisY >= 0.0 && axisY <= viewport.canvasHeight()) {
            graphics.strokeLine(0.0, axisY, viewport.canvasWidth(), axisY);
        }
    }

    private void paintCells(GraphicsContext graphics, MapWorkspaceRenderModel renderModel, MapViewport viewport) {
        double scale = MapCameraController.BASE_TILE_PIXELS * viewport.zoom();
        double inset = Math.max(1.5, Math.min(5.0, scale * 0.08));
        double size = Math.max(6.0, scale - inset * 2.0);
        double arc = Math.max(4.0, size * 0.18);
        for (MapCellViewModel cell : renderModel.scene().cells()) {
            double x = worldToScreenX(cell.q(), viewport, scale) + inset;
            double y = worldToScreenY(cell.r(), viewport, scale) + inset;
            if (x + size < -8.0 || y + size < -8.0 || x > viewport.canvasWidth() + 8.0 || y > viewport.canvasHeight() + 8.0) {
                continue;
            }
            graphics.setFill(fillFor(cell));
            graphics.fillRoundRect(x, y, size, size, arc, arc);
            graphics.setStroke(strokeFor(cell));
            graphics.setLineWidth(cell.current() ? 2.2 : 1.35);
            graphics.strokeRoundRect(x, y, size, size, arc, arc);
            if (cell.current()) {
                graphics.setStroke(CURRENT_STROKE);
                graphics.setLineWidth(1.1);
                graphics.strokeRoundRect(x + 2.0, y + 2.0, Math.max(0.0, size - 4.0), Math.max(0.0, size - 4.0), arc, arc);
            }
        }
    }

    private void paintEdges(GraphicsContext graphics, MapWorkspaceRenderModel renderModel, MapViewport viewport) {
        double scale = MapCameraController.BASE_TILE_PIXELS * viewport.zoom();
        for (MapEdgeViewModel edge : renderModel.scene().edges()) {
            double fromX = worldToScreenX(edge.fromQ(), viewport, scale) + scale / 2.0;
            double fromY = worldToScreenY(edge.fromR(), viewport, scale) + scale / 2.0;
            double toX = worldToScreenX(edge.toQ(), viewport, scale) + scale / 2.0;
            double toY = worldToScreenY(edge.toR(), viewport, scale) + scale / 2.0;
            if ("door".equalsIgnoreCase(edge.kind())) {
                graphics.setStroke(DOOR_STROKE);
                graphics.setLineWidth(3.6);
                graphics.strokeLine(fromX, fromY, toX, toY);
                paintDoorMarker(graphics, edge, (fromX + toX) / 2.0, (fromY + toY) / 2.0);
                continue;
            }
            graphics.setStroke(WALL_STROKE);
            graphics.setLineWidth(edge.interactive() ? 3.0 : 2.4);
            graphics.strokeLine(fromX, fromY, toX, toY);
        }
    }

    private void paintDoorMarker(GraphicsContext graphics, MapEdgeViewModel edge, double centerX, double centerY) {
        double radius = 10.0;
        graphics.setFill(LABEL_FILL);
        graphics.fillOval(centerX - radius, centerY - radius, radius * 2.0, radius * 2.0);
        graphics.setStroke(DOOR_STROKE);
        graphics.setLineWidth(1.4);
        graphics.strokeOval(centerX - radius, centerY - radius, radius * 2.0, radius * 2.0);
        graphics.setFill(DOOR_STROKE);
        graphics.setFont(MARKER_FONT);
        graphics.setTextAlign(TextAlignment.CENTER);
        graphics.setTextBaseline(VPos.CENTER);
        String marker = edge.label().isBlank() ? "D" : abbreviate(edge.label(), 2);
        graphics.fillText(marker, centerX, centerY + 0.5);
    }

    private void paintLabels(GraphicsContext graphics, MapWorkspaceRenderModel renderModel, MapViewport viewport) {
        double scale = MapCameraController.BASE_TILE_PIXELS * viewport.zoom();
        if (scale < 18.0) {
            return;
        }
        Map<String, LabelGroup> groups = new LinkedHashMap<>();
        for (MapCellViewModel cell : renderModel.scene().cells()) {
            if (cell.label() == null || cell.label().isBlank() || cell.ownerKind() == null || cell.ownerKind().isBlank()) {
                continue;
            }
            String key = cell.ownerKind() + "|" + cell.ownerId() + "|" + cell.label();
            groups.computeIfAbsent(key, ignored -> new LabelGroup(cell.label()))
                    .include(cell.q() + 0.5, cell.r() + 0.5, cell.current());
        }
        graphics.setFont(LABEL_FONT);
        graphics.setTextAlign(TextAlignment.CENTER);
        graphics.setTextBaseline(VPos.CENTER);
        for (LabelGroup group : groups.values()) {
            double screenX = worldToScreenX(group.centerX(), viewport, scale);
            double screenY = worldToScreenY(group.centerY(), viewport, scale);
            double width = Math.max(56.0, Math.min(160.0, group.label().length() * 7.1 + 18.0));
            double height = 24.0;
            if (screenX + width / 2.0 < 0.0 || screenY + height / 2.0 < 0.0
                    || screenX - width / 2.0 > viewport.canvasWidth()
                    || screenY - height / 2.0 > viewport.canvasHeight()) {
                continue;
            }
            graphics.setFill(LABEL_FILL);
            graphics.fillRoundRect(screenX - width / 2.0, screenY - height / 2.0, width, height, 14.0, 14.0);
            graphics.setStroke(group.current() ? CURRENT_STROKE : LABEL_BORDER);
            graphics.setLineWidth(group.current() ? 1.6 : 1.0);
            graphics.strokeRoundRect(screenX - width / 2.0, screenY - height / 2.0, width, height, 14.0, 14.0);
            graphics.setFill(LABEL_TEXT);
            graphics.fillText(group.label(), screenX, screenY + 0.5);
        }
    }

    private void paintHud(GraphicsContext graphics, MapViewport viewport) {
        graphics.setFill(HUD_TEXT);
        graphics.setFont(HUD_FONT);
        graphics.setTextAlign(TextAlignment.RIGHT);
        graphics.setTextBaseline(VPos.BOTTOM);
        String reference = String.format("x %.1f  y %.1f  z %.0f%%", viewport.centerX(), viewport.centerY(), viewport.zoom() * 100.0);
        graphics.fillText(reference, viewport.canvasWidth() - 18.0, viewport.canvasHeight() - 16.0);
    }

    private void paintOverlayMessage(GraphicsContext graphics, MapWorkspaceRenderModel renderModel, MapViewport viewport) {
        if (renderModel.overlayMessage().isBlank()) {
            return;
        }
        graphics.setTextAlign(TextAlignment.CENTER);
        graphics.setTextBaseline(VPos.CENTER);
        graphics.setFont(Font.font("SansSerif", FontWeight.BOLD, renderModel.mapLoaded() ? 19.0 : 22.0));
        graphics.setFill(renderModel.mapLoaded() ? LOADED_NOTE : PLACEHOLDER);
        graphics.fillText(renderModel.overlayMessage(), viewport.canvasWidth() / 2.0, viewport.canvasHeight() / 2.0);
    }

    private Color fillFor(MapCellViewModel cell) {
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

    private Color strokeFor(MapCellViewModel cell) {
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

    private Color gridTierColor(int tier) {
        return switch (tier) {
            case 0 -> GRID_MINOR;
            case 1 -> GRID_MEDIUM;
            case 2 -> GRID_MAJOR;
            default -> GRID_MAX;
        };
    }

    private double gridTierWidth(int tier) {
        return switch (tier) {
            case 0 -> 0.9;
            case 1 -> 1.05;
            case 2 -> 1.4;
            default -> 1.8;
        };
    }

    private int align(int value, int spacing) {
        int remainder = Math.floorMod(value, spacing);
        return remainder == 0 ? value : value + (spacing - remainder);
    }

    private double worldToScreenX(double worldX, MapViewport viewport, double scale) {
        return (worldX - viewport.centerX()) * scale + viewport.canvasWidth() / 2.0;
    }

    private double worldToScreenY(double worldY, MapViewport viewport, double scale) {
        return (worldY - viewport.centerY()) * scale + viewport.canvasHeight() / 2.0;
    }

    private static String abbreviate(String text, int maxLength) {
        if (text == null || text.isBlank()) {
            return "";
        }
        String compact = text.trim().replaceAll("\\s+", "");
        return compact.length() <= maxLength
                ? compact.toUpperCase(Locale.ROOT)
                : compact.substring(0, maxLength).toUpperCase(Locale.ROOT);
    }

    private static final class LabelGroup {
        private final String label;
        private double sumX;
        private double sumY;
        private int count;
        private boolean current;

        private LabelGroup(String label) {
            this.label = label;
        }

        private void include(double x, double y, boolean current) {
            sumX += x;
            sumY += y;
            count++;
            this.current = this.current || current;
        }

        private String label() {
            return label;
        }

        private double centerX() {
            return count == 0 ? 0.0 : sumX / count;
        }

        private double centerY() {
            return count == 0 ? 0.0 : sumY / count;
        }

        private boolean current() {
            return current;
        }
    }
}
