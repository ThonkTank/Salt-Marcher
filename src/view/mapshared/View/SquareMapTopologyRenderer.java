package src.view.mapshared.View;
import javafx.geometry.VPos;
import javafx.scene.canvas.Canvas;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.text.TextAlignment;
import src.view.mapshared.ViewModel.MapCellViewModel;
import src.view.mapshared.ViewModel.MapEdgeViewModel;
import src.view.mapshared.ViewModel.MapViewport;
import src.view.mapshared.ViewModel.MapWorkspaceRenderModel;
import java.util.LinkedHashMap;
/**
 * Canvas renderer aligned with the original Salt Marcher dungeon presentation.
 */
final class SquareMapTopologyRenderer implements MapTopologyRenderer {
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
        graphics.setFill(SquareMapRenderTheme.BACKGROUND);
        graphics.fillRect(0.0, 0.0, viewport.canvasWidth(), viewport.canvasHeight());
        SquareMapGridPainter.paintGrid(graphics, viewport);
        paintCells(graphics, renderModel, viewport);
        paintEdges(graphics, renderModel, viewport);
        SquareMapLabelPainter.paintLabels(graphics, renderModel, viewport);
        paintHud(graphics, viewport);
        paintOverlayMessage(graphics, renderModel, viewport);
    }
    private void paintCells(GraphicsContext graphics, MapWorkspaceRenderModel renderModel, MapViewport viewport) {
        double scale = MapCameraController.baseTilePixels() * viewport.zoom();
        double inset = Math.max(1.5, Math.min(5.0, scale * 0.08));
        double size = Math.max(6.0, scale - inset * 2.0);
        double arc = Math.max(4.0, size * 0.18);
        for (MapCellViewModel cell : renderModel.scene().cells()) {
            double x = SquareMapRenderGeometry.worldToScreenX(cell.q(), viewport, scale) + inset;
            double y = SquareMapRenderGeometry.worldToScreenY(cell.r(), viewport, scale) + inset;
            if (x + size < -8.0 || y + size < -8.0 || x > viewport.canvasWidth() + 8.0 || y > viewport.canvasHeight() + 8.0) {
                continue;
            }
            graphics.setFill(SquareMapRenderTheme.fillFor(cell));
            graphics.fillRoundRect(x, y, size, size, arc, arc);
            graphics.setStroke(SquareMapRenderTheme.strokeFor(cell));
            graphics.setLineWidth(cell.current() ? 2.2 : 1.35);
            graphics.strokeRoundRect(x, y, size, size, arc, arc);
            if (cell.current()) {
                graphics.setStroke(SquareMapRenderTheme.currentStroke());
                graphics.setLineWidth(1.1);
                graphics.strokeRoundRect(x + 2.0, y + 2.0, Math.max(0.0, size - 4.0), Math.max(0.0, size - 4.0), arc, arc);
            }
        }
    }
    private void paintEdges(GraphicsContext graphics, MapWorkspaceRenderModel renderModel, MapViewport viewport) {
        double scale = MapCameraController.baseTilePixels() * viewport.zoom();
        for (MapEdgeViewModel edge : renderModel.scene().edges()) {
            double fromX = SquareMapRenderGeometry.worldToScreenX(edge.fromQ(), viewport, scale) + scale / 2.0;
            double fromY = SquareMapRenderGeometry.worldToScreenY(edge.fromR(), viewport, scale) + scale / 2.0;
            double toX = SquareMapRenderGeometry.worldToScreenX(edge.toQ(), viewport, scale) + scale / 2.0;
            double toY = SquareMapRenderGeometry.worldToScreenY(edge.toR(), viewport, scale) + scale / 2.0;
            if ("door".equalsIgnoreCase(edge.kind())) {
                graphics.setStroke(SquareMapRenderTheme.DOOR_STROKE);
                graphics.setLineWidth(3.6);
                graphics.strokeLine(fromX, fromY, toX, toY);
                paintDoorMarker(graphics, edge, (fromX + toX) / 2.0, (fromY + toY) / 2.0);
                continue;
            }
            graphics.setStroke(SquareMapRenderTheme.WALL_STROKE);
            graphics.setLineWidth(edge.interactive() ? 3.0 : 2.4);
            graphics.strokeLine(fromX, fromY, toX, toY);
        }
    }
    private void paintDoorMarker(GraphicsContext graphics, MapEdgeViewModel edge, double centerX, double centerY) {
        double radius = 10.0;
        graphics.setFill(SquareMapRenderTheme.LABEL_FILL);
        graphics.fillOval(centerX - radius, centerY - radius, radius * 2.0, radius * 2.0);
        graphics.setStroke(SquareMapRenderTheme.DOOR_STROKE);
        graphics.setLineWidth(1.4);
        graphics.strokeOval(centerX - radius, centerY - radius, radius * 2.0, radius * 2.0);
        graphics.setFill(SquareMapRenderTheme.DOOR_STROKE);
        graphics.setFont(SquareMapRenderTheme.MARKER_FONT);
        graphics.setTextAlign(TextAlignment.CENTER);
        graphics.setTextBaseline(VPos.CENTER);
        String marker = edge.label().isBlank() ? "D" : SquareMapRenderGeometry.abbreviate(edge.label(), 2);
        graphics.fillText(marker, centerX, centerY + 0.5);
    }
    private void paintHud(GraphicsContext graphics, MapViewport viewport) {
        graphics.setFill(SquareMapRenderTheme.HUD_TEXT);
        graphics.setFont(SquareMapRenderTheme.HUD_FONT);
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
        graphics.setFont(javafx.scene.text.Font.font("SansSerif", javafx.scene.text.FontWeight.BOLD, renderModel.mapLoaded() ? 19.0 : 22.0));
        graphics.setFill(SquareMapRenderTheme.overlayMessageFill(renderModel.mapLoaded()));
        graphics.fillText(renderModel.overlayMessage(), viewport.canvasWidth() / 2.0, viewport.canvasHeight() / 2.0);
    }
}
