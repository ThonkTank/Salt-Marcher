package features.dungeon.application.editor.session;

import org.jspecify.annotations.Nullable;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapId;
import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.api.editor.DungeonEditorToolSelection;

public record DungeonEditorSession(
        @Nullable MapId selectedMapId,
        DungeonEditorSessionValues.ViewMode viewMode,
        DungeonEditorToolSelection toolSelection,
        int projectionLevel,
        DungeonEditorSessionValues.OverlaySettings overlaySettings,
        DungeonEditorSessionValues.Selection selection,
        DungeonEditorSessionValues.Preview preview,
        String statusText,
        DungeonEditorCommandOutcome commandOutcome
) {

    public DungeonEditorSession {
        viewMode = viewMode == null ? DungeonEditorSessionValues.ViewMode.defaultMode() : viewMode;
        toolSelection = toolSelection == null ? DungeonEditorToolSelection.select() : toolSelection;
        overlaySettings = overlaySettings == null ? DungeonEditorSessionValues.OverlaySettings.defaults() : overlaySettings;
        selection = selection == null ? DungeonEditorSessionValues.Selection.empty() : selection;
        preview = preview == null ? DungeonEditorSessionValues.Preview.none() : preview;
        statusText = statusText == null ? "" : statusText;
        commandOutcome = commandOutcome == null ? DungeonEditorCommandOutcome.idle() : commandOutcome;
    }

    public static DungeonEditorSession empty() {
        return new DungeonEditorSession(
                null,
                DungeonEditorSessionValues.ViewMode.defaultMode(),
                DungeonEditorToolSelection.select(),
                0,
                DungeonEditorSessionValues.OverlaySettings.defaults(),
                DungeonEditorSessionValues.Selection.empty(),
                DungeonEditorSessionValues.Preview.none(),
                "",
                DungeonEditorCommandOutcome.idle());
    }

    public boolean hasSelectedMap() {
        return DungeonEditorSessionValues.hasSelectedMap(selectedMapId);
    }

    public DungeonEditorSession withSelectedMap(@Nullable MapId nextSelectedMapId) {
        return copy(nextSelectedMapId, viewMode, toolSelection, projectionLevel, overlaySettings,
                selection, preview, statusText, commandOutcome);
    }

    public DungeonEditorSession withViewMode(DungeonEditorSessionValues.ViewMode nextViewMode) {
        return copy(selectedMapId, nextViewMode, toolSelection, projectionLevel, overlaySettings,
                selection, preview, statusText, commandOutcome);
    }

    public DungeonEditorSession withToolSelection(DungeonEditorToolSelection nextSelection) {
        return copy(selectedMapId, viewMode, nextSelection, projectionLevel, overlaySettings,
                selection, preview, statusText, commandOutcome);
    }

    public DungeonEditorSession withProjectionLevel(int nextProjectionLevel) {
        return copy(selectedMapId, viewMode, toolSelection, nextProjectionLevel, overlaySettings,
                selection, preview, statusText, commandOutcome);
    }

    public DungeonEditorSession shiftProjectionLevel(int delta) {
        return withProjectionLevel(projectionLevel + delta);
    }

    public DungeonEditorSession withOverlaySettings(DungeonEditorSessionValues.OverlaySettings nextOverlaySettings) {
        return copy(selectedMapId, viewMode, toolSelection, projectionLevel, nextOverlaySettings,
                selection, preview, statusText, commandOutcome);
    }

    public DungeonEditorSession withSelection(DungeonEditorSessionValues.Selection nextSelection) {
        return copy(selectedMapId, viewMode, toolSelection, projectionLevel, overlaySettings,
                nextSelection, preview, statusText, commandOutcome);
    }

    public DungeonEditorSession clearSelection() {
        return withSelection(DungeonEditorSessionValues.Selection.empty());
    }

    public DungeonEditorSession withPreview(DungeonEditorSessionValues.Preview nextPreview) {
        return copy(selectedMapId, viewMode, toolSelection, projectionLevel, overlaySettings,
                selection, nextPreview, statusText, commandOutcome);
    }

    public DungeonEditorSession clearPreview() {
        return withPreview(DungeonEditorSessionValues.Preview.none());
    }

    public DungeonEditorSession withStatusText(String nextStatusText) {
        return copy(selectedMapId, viewMode, toolSelection, projectionLevel, overlaySettings,
                selection, preview, nextStatusText, DungeonEditorCommandOutcome.idle());
    }

    public DungeonEditorSession withCommandOutcome(DungeonEditorCommandOutcome nextOutcome) {
        return copy(selectedMapId, viewMode, toolSelection, projectionLevel, overlaySettings,
                selection, preview, "", nextOutcome);
    }

    public DungeonEditorSession withCommandStatus(
            String nextStatusText,
            DungeonEditorCommandOutcome nextOutcome
    ) {
        return copy(selectedMapId, viewMode, toolSelection, projectionLevel, overlaySettings,
                selection, preview, nextStatusText, nextOutcome);
    }

    public DungeonEditorSession clearTransientState(String nextStatusText) {
        return clearPreview().withStatusText(nextStatusText);
    }

    public DungeonEditorSession clearPreviewWithCommandOutcome(DungeonEditorCommandOutcome nextOutcome) {
        return clearPreview().withCommandOutcome(nextOutcome);
    }

    private static DungeonEditorSession copy(
            @Nullable MapId selectedMapId,
            DungeonEditorSessionValues.ViewMode viewMode,
            DungeonEditorToolSelection toolSelection,
            int projectionLevel,
            DungeonEditorSessionValues.OverlaySettings overlaySettings,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Preview preview,
            String statusText,
            DungeonEditorCommandOutcome commandOutcome
    ) {
        return new DungeonEditorSession(
                selectedMapId, viewMode, toolSelection, projectionLevel, overlaySettings,
                selection, preview, statusText, commandOutcome);
    }
}
