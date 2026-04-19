package src.view.mapcanvas.View;
import javafx.scene.canvas.GraphicsContext;
import src.view.mapcanvas.api.MapCanvasViewport;
final class SquareMapGridPainter {
    private SquareMapGridPainter() {
    }
    static void paintGrid(GraphicsContext graphics, MapCanvasViewport viewport) {
        double scale = MapCameraController.baseTilePixels() * viewport.zoom();
        for (int index = 0; index < SquareMapRenderTheme.gridStepCount(); index++) {
            int gridStep = SquareMapRenderTheme.gridStep(index);
            double pixelSpacing = scale * gridStep;
            if (pixelSpacing < 10.0) {
                continue;
            }
            paintGridTier(graphics, viewport, scale, gridStep, index);
        }
        paintAxis(graphics, viewport, scale);
    }
    private static void paintGridTier(GraphicsContext graphics, MapCanvasViewport viewport, double scale, int spacingSquares, int tier) {
        int minColumn = (int) Math.floor(viewport.centerX() - viewport.canvasWidth() / (2.0 * scale)) - spacingSquares;
        int maxColumn = (int) Math.ceil(viewport.centerX() + viewport.canvasWidth() / (2.0 * scale)) + spacingSquares;
        int minRow = (int) Math.floor(viewport.centerY() - viewport.canvasHeight() / (2.0 * scale)) - spacingSquares;
        int maxRow = (int) Math.ceil(viewport.centerY() + viewport.canvasHeight() / (2.0 * scale)) + spacingSquares;
        graphics.setStroke(SquareMapRenderTheme.gridTierColor(tier));
        graphics.setLineWidth(SquareMapRenderTheme.gridTierWidth(tier));
        for (int column = align(minColumn, spacingSquares); column <= maxColumn; column += spacingSquares) {
            if (column == 0) {
                continue;
            }
            double x = SquareMapRenderGeometry.worldToScreenX(column, viewport, scale);
            graphics.strokeLine(x, 0.0, x, viewport.canvasHeight());
        }
        for (int row = align(minRow, spacingSquares); row <= maxRow; row += spacingSquares) {
            if (row == 0) {
                continue;
            }
            double y = SquareMapRenderGeometry.worldToScreenY(row, viewport, scale);
            graphics.strokeLine(0.0, y, viewport.canvasWidth(), y);
        }
    }
    private static void paintAxis(GraphicsContext graphics, MapCanvasViewport viewport, double scale) {
        graphics.setStroke(SquareMapRenderTheme.GRID_AXIS);
        graphics.setLineWidth(2.6);
        double axisX = SquareMapRenderGeometry.worldToScreenX(0.0, viewport, scale);
        double axisY = SquareMapRenderGeometry.worldToScreenY(0.0, viewport, scale);
        if (axisX >= 0.0 && axisX <= viewport.canvasWidth()) {
            graphics.strokeLine(axisX, 0.0, axisX, viewport.canvasHeight());
        }
        if (axisY >= 0.0 && axisY <= viewport.canvasHeight()) {
            graphics.strokeLine(0.0, axisY, viewport.canvasWidth(), axisY);
        }
    }
    private static int align(int value, int spacing) {
        int remainder = Math.floorMod(value, spacing);
        return remainder == 0 ? value : value + spacing - remainder;
    }
}
