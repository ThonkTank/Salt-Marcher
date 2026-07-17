package features.dungeon.application.editor.session;

import org.jspecify.annotations.Nullable;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues.MapId;
import features.dungeon.api.editor.DungeonEditorToolSelection;

public record DungeonEditorSession(
        @Nullable MapId selectedMapId,
        DungeonEditorSessionValues.ViewMode viewMode,
        DungeonEditorToolSelection toolSelection,
        int projectionLevel,
        DungeonEditorSessionValues.OverlaySettings overlaySettings,
        DungeonEditorSessionValues.Selection selection,
        DungeonEditorSessionValues.Preview preview,
        String statusText
) {

    public DungeonEditorSession {
        viewMode = viewMode == null ? DungeonEditorSessionValues.ViewMode.defaultMode() : viewMode;
        toolSelection = toolSelection == null ? DungeonEditorToolSelection.select() : toolSelection;
        overlaySettings = overlaySettings == null ? DungeonEditorSessionValues.OverlaySettings.defaults() : overlaySettings;
        selection = selection == null ? DungeonEditorSessionValues.Selection.empty() : selection;
        preview = preview == null ? DungeonEditorSessionValues.Preview.none() : preview;
        statusText = statusText == null ? "" : statusText;
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
                "");
    }

    public boolean hasSelectedMap() {
        return DungeonEditorSessionValues.hasSelectedMap(selectedMapId);
    }

    public DungeonEditorSession withSelectedMap(@Nullable MapId nextSelectedMapId) {
        return new DungeonEditorSession(
                nextSelectedMapId,
                viewMode,
                toolSelection,
                projectionLevel,
                overlaySettings,
                selection,
                preview,
                statusText);
    }

    public DungeonEditorSession withViewMode(DungeonEditorSessionValues.ViewMode nextViewMode) {
        return new DungeonEditorSession(
                selectedMapId,
                nextViewMode,
                toolSelection,
                projectionLevel,
                overlaySettings,
                selection,
                preview,
                statusText);
    }

    public DungeonEditorSession withToolSelection(DungeonEditorToolSelection nextSelection) {
        return new DungeonEditorSession(
                selectedMapId,
                viewMode,
                nextSelection,
                projectionLevel,
                overlaySettings,
                selection,
                preview,
                statusText);
    }

    public DungeonEditorSession withProjectionLevel(int nextProjectionLevel) {
        return new DungeonEditorSession(
                selectedMapId,
                viewMode,
                toolSelection,
                nextProjectionLevel,
                overlaySettings,
                selection,
                preview,
                statusText);
    }

    public DungeonEditorSession shiftProjectionLevel(int delta) {
        return withProjectionLevel(projectionLevel + delta);
    }

    public DungeonEditorSession withOverlaySettings(DungeonEditorSessionValues.OverlaySettings nextOverlaySettings) {
        return new DungeonEditorSession(
                selectedMapId,
                viewMode,
                toolSelection,
                projectionLevel,
                nextOverlaySettings,
                selection,
                preview,
                statusText);
    }

    public DungeonEditorSession withSelection(DungeonEditorSessionValues.Selection nextSelection) {
        return new DungeonEditorSession(
                selectedMapId,
                viewMode,
                toolSelection,
                projectionLevel,
                overlaySettings,
                nextSelection,
                preview,
                statusText);
    }

    public DungeonEditorSession clearSelection() {
        return withSelection(DungeonEditorSessionValues.Selection.empty());
    }

    public DungeonEditorSession withPreview(DungeonEditorSessionValues.Preview nextPreview) {
        return new DungeonEditorSession(
                selectedMapId,
                viewMode,
                toolSelection,
                projectionLevel,
                overlaySettings,
                selection,
                nextPreview,
                statusText);
    }

    public DungeonEditorSession clearPreview() {
        return withPreview(DungeonEditorSessionValues.Preview.none());
    }

    public DungeonEditorSession withStatusText(String nextStatusText) {
        return new DungeonEditorSession(
                selectedMapId,
                viewMode,
                toolSelection,
                projectionLevel,
                overlaySettings,
                selection,
                preview,
                nextStatusText);
    }

    public DungeonEditorSession clearTransientState(String nextStatusText) {
        return clearPreview().withStatusText(nextStatusText);
    }
}
