package src.view.mapshared.View;

import javafx.geometry.VPos;
import javafx.scene.Node;
import javafx.scene.canvas.Canvas;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.paint.Color;
import javafx.scene.text.Font;
import javafx.scene.text.TextAlignment;
import src.view.mapshared.Controller.MapCameraController;
import src.view.mapshared.Model.MapViewport;
import src.view.mapshared.Model.MapWorkspaceRenderModel;

/**
 * View-local square-grid renderer for the first real dungeon map slice.
 */
public final class SquareMapTopologyRenderer implements MapTopologyRenderer {

    private static final Color BACKGROUND = Color.rgb(247, 245, 240);
    private static final Color GRID_MINOR = Color.rgb(154, 149, 138, 0.55);
    private static final Color GRID_MEDIUM = Color.rgb(120, 116, 108, 0.7);
    private static final Color GRID_MAJOR = Color.rgb(88, 84, 78, 0.82);
    private static final Color GRID_ORIGIN = Color.rgb(53, 51, 47, 0.95);
    private static final Color PLACEHOLDER = Color.rgb(55, 55, 55, 0.86);
    private static final Color LOADED_NOTE = Color.rgb(65, 65, 65, 0.78);

    @Override
    public Node render(MapWorkspaceRenderModel renderModel, MapViewport viewport) {
        double width = Math.max(1.0, viewport.canvasWidth());
        double height = Math.max(1.0, viewport.canvasHeight());
        Canvas canvas = new Canvas(width, height);
        canvas.getStyleClass().add("dungeon-map-scene");
        paint(canvas.getGraphicsContext2D(), renderModel, viewport);
        return canvas;
    }

    private void paint(GraphicsContext graphics, MapWorkspaceRenderModel renderModel, MapViewport viewport) {
        double width = viewport.canvasWidth();
        double height = viewport.canvasHeight();
        graphics.setFill(BACKGROUND);
        graphics.fillRect(0, 0, width, height);
        paintGrid(graphics, viewport);
        paintOverlayMessage(graphics, renderModel, width, height);
    }

    private void paintGrid(GraphicsContext graphics, MapViewport viewport) {
        double scale = MapCameraController.BASE_TILE_PIXELS * viewport.zoom();
        double leftWorld = viewport.centerX() - viewport.canvasWidth() / (2.0 * scale);
        double rightWorld = viewport.centerX() + viewport.canvasWidth() / (2.0 * scale);
        double topWorld = viewport.centerY() - viewport.canvasHeight() / (2.0 * scale);
        double bottomWorld = viewport.centerY() + viewport.canvasHeight() / (2.0 * scale);

        int minColumn = (int) Math.floor(leftWorld) - 1;
        int maxColumn = (int) Math.ceil(rightWorld) + 1;
        int minRow = (int) Math.floor(topWorld) - 1;
        int maxRow = (int) Math.ceil(bottomWorld) + 1;

        for (int column = minColumn; column <= maxColumn; column++) {
            paintGridLine(
                    graphics,
                    worldToScreenX(column, viewport, scale),
                    0.0,
                    worldToScreenX(column, viewport, scale),
                    viewport.canvasHeight(),
                    column);
        }
        for (int row = minRow; row <= maxRow; row++) {
            paintGridLine(
                    graphics,
                    0.0,
                    worldToScreenY(row, viewport, scale),
                    viewport.canvasWidth(),
                    worldToScreenY(row, viewport, scale),
                    row);
        }
    }

    private void paintGridLine(GraphicsContext graphics, double x1, double y1, double x2, double y2, int coordinate) {
        if (coordinate == 0) {
            graphics.setStroke(GRID_ORIGIN);
            graphics.setLineWidth(2.4);
        } else if (coordinate % 10 == 0) {
            graphics.setStroke(GRID_MAJOR);
            graphics.setLineWidth(1.6);
        } else if (coordinate % 5 == 0) {
            graphics.setStroke(GRID_MEDIUM);
            graphics.setLineWidth(1.05);
        } else {
            graphics.setStroke(GRID_MINOR);
            graphics.setLineWidth(0.6);
        }
        graphics.strokeLine(x1, y1, x2, y2);
    }

    private void paintOverlayMessage(GraphicsContext graphics, MapWorkspaceRenderModel renderModel, double width, double height) {
        if (renderModel.overlayMessage().isBlank()) {
            return;
        }
        graphics.setTextAlign(TextAlignment.CENTER);
        graphics.setTextBaseline(VPos.CENTER);
        graphics.setFont(Font.font("System", renderModel.mapLoaded() ? 19.0 : 22.0));
        graphics.setFill(renderModel.mapLoaded() ? LOADED_NOTE : PLACEHOLDER);
        graphics.fillText(renderModel.overlayMessage(), width / 2.0, height / 2.0);
    }

    private double worldToScreenX(double worldX, MapViewport viewport, double scale) {
        return (worldX - viewport.centerX()) * scale + viewport.canvasWidth() / 2.0;
    }

    private double worldToScreenY(double worldY, MapViewport viewport, double scale) {
        return (worldY - viewport.centerY()) * scale + viewport.canvasHeight() / 2.0;
    }
}
