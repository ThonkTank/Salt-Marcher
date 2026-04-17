package src.view.mapshared.Model;

/**
 * View-local workspace render payload.
 */
public record MapWorkspaceRenderModel(
        String title,
        String subtitle,
        String modeLabel,
        String statusLabel,
        String summaryLabel,
        boolean mapLoaded,
        String overlayMessage,
        MapWorkspaceSceneViewData scene
) {

    public MapWorkspaceRenderModel {
        title = title == null || title.isBlank() ? "Dungeon Map" : title;
        subtitle = subtitle == null ? "" : subtitle;
        modeLabel = modeLabel == null ? "" : modeLabel;
        statusLabel = statusLabel == null ? "" : statusLabel;
        summaryLabel = summaryLabel == null ? "" : summaryLabel;
        overlayMessage = overlayMessage == null ? "" : overlayMessage;
        scene = scene == null ? MapWorkspaceSceneViewData.empty() : scene;
    }
}
