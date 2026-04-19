package src.view.mapshared.api;

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
}
