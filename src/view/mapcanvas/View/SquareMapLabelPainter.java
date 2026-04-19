package src.view.mapcanvas.View;
import javafx.geometry.VPos;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.text.TextAlignment;
import src.view.mapcanvas.api.MapCanvasCell;
import src.view.mapcanvas.api.MapCanvasViewport;
import src.view.mapcanvas.api.MapCanvasRenderModel;
import java.util.LinkedHashMap;
import java.util.Map;
final class SquareMapLabelPainter {
    private SquareMapLabelPainter() {
    }
    static void paintLabels(GraphicsContext graphics, MapCanvasRenderModel renderModel, MapCanvasViewport viewport) {
        double scale = MapCameraController.baseTilePixels() * viewport.zoom();
        if (scale < 18.0) {
            return;
        }
        Map<String, LabelGroup> groups = collectLabelGroups(renderModel);
        graphics.setFont(SquareMapRenderTheme.LABEL_FONT);
        graphics.setTextAlign(TextAlignment.CENTER);
        graphics.setTextBaseline(VPos.CENTER);
        for (LabelGroup group : groups.values()) {
            paintLabelGroup(graphics, viewport, scale, group);
        }
    }
    private static Map<String, LabelGroup> collectLabelGroups(MapCanvasRenderModel renderModel) {
        Map<String, LabelGroup> groups = new LinkedHashMap<>();
        for (MapCanvasCell cell : renderModel.scene().cells()) {
            if (cell.label() == null || cell.label().isBlank() || cell.ownerKind() == null || cell.ownerKind().isBlank()) {
                continue;
            }
            String key = cell.ownerKind() + "|" + cell.ownerId() + "|" + cell.label();
            groups.computeIfAbsent(key, ignored -> new LabelGroup(cell.label()))
                    .include(cell.q() + 0.5, cell.r() + 0.5, cell.current());
        }
        return groups;
    }
    private static void paintLabelGroup(
            GraphicsContext graphics,
            MapCanvasViewport viewport,
            double scale,
            LabelGroup group
    ) {
        double screenX = SquareMapRenderGeometry.worldToScreenX(group.centerX(), viewport, scale);
        double screenY = SquareMapRenderGeometry.worldToScreenY(group.centerY(), viewport, scale);
        double width = Math.max(56.0, Math.min(160.0, group.label().length() * 7.1 + 18.0));
        double height = 24.0;
        if (offscreen(screenX, screenY, width, height, viewport)) {
            return;
        }
        graphics.setFill(SquareMapRenderTheme.LABEL_FILL);
        graphics.fillRoundRect(screenX - width / 2.0, screenY - height / 2.0, width, height, 14.0, 14.0);
        graphics.setStroke(SquareMapRenderTheme.labelBorder(group.current()));
        graphics.setLineWidth(group.current() ? 1.6 : 1.0);
        graphics.strokeRoundRect(screenX - width / 2.0, screenY - height / 2.0, width, height, 14.0, 14.0);
        graphics.setFill(SquareMapRenderTheme.LABEL_TEXT);
        graphics.fillText(group.label(), screenX, screenY + 0.5);
    }
    private static boolean offscreen(
            double screenX,
            double screenY,
            double width,
            double height,
            MapCanvasViewport viewport
    ) {
        return screenX + width / 2.0 < 0.0
                || screenY + height / 2.0 < 0.0
                || screenX - width / 2.0 > viewport.canvasWidth()
                || screenY - height / 2.0 > viewport.canvasHeight();
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
