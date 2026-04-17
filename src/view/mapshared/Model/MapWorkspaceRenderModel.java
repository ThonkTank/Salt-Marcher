package src.view.mapshared.Model;

import src.domain.mapcore.api.MapRenderPayload;

import java.util.List;

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
        MapRenderPayload renderPayload
) {

    public MapWorkspaceRenderModel {
        title = title == null || title.isBlank() ? "Dungeon Map" : title;
        subtitle = subtitle == null ? "" : subtitle;
        modeLabel = modeLabel == null ? "" : modeLabel;
        statusLabel = statusLabel == null ? "" : statusLabel;
        summaryLabel = summaryLabel == null ? "" : summaryLabel;
        overlayMessage = overlayMessage == null ? "" : overlayMessage;
        renderPayload = renderPayload == null ? MapRenderPayload.empty() : renderPayload;
    }
}
