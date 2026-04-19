package src.view.mapcanvas.api;

/**
 * View-local workspace render payload.
 */
public record MapCanvasRenderModel(
        String title,
        String subtitle,
        String modeLabel,
        String statusLabel,
        String summaryLabel,
        boolean mapLoaded,
        String overlayMessage,
        MapCanvasScene scene
) {

    public MapCanvasRenderModel {
        title = title == null || title.isBlank() ? "Dungeon Map" : title;
        subtitle = subtitle == null ? "" : subtitle;
        modeLabel = modeLabel == null ? "" : modeLabel;
        statusLabel = statusLabel == null ? "" : statusLabel;
        summaryLabel = summaryLabel == null ? "" : summaryLabel;
        overlayMessage = overlayMessage == null ? "" : overlayMessage;
        scene = scene == null ? MapCanvasScene.empty() : scene;
    }
}
