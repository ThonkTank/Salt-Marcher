package src.view.mapshared.View;

import src.view.mapshared.Model.MapViewport;

import java.util.Locale;

final class SquareMapRenderGeometry {

    private SquareMapRenderGeometry() {
    }

    static double worldToScreenX(double worldX, MapViewport viewport, double scale) {
        return (worldX - viewport.centerX()) * scale + viewport.canvasWidth() / 2.0;
    }

    static double worldToScreenY(double worldY, MapViewport viewport, double scale) {
        return (worldY - viewport.centerY()) * scale + viewport.canvasHeight() / 2.0;
    }

    static String abbreviate(String text, int maxLength) {
        if (text == null || text.isBlank()) {
            return "";
        }
        String compact = text.trim().replaceAll("\\s+", "");
        return compact.length() <= maxLength
                ? compact.toUpperCase(Locale.ROOT)
                : compact.substring(0, maxLength).toUpperCase(Locale.ROOT);
    }
}
