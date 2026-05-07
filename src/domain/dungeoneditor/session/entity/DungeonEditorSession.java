package src.domain.dungeoneditor.session.entity;

import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionValues;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues.MapId;

public record DungeonEditorSession(
        @Nullable MapId selectedMapId,
        DungeonEditorSessionValues.ViewMode viewMode,
        DungeonEditorSessionValues.Tool selectedTool,
        int projectionLevel,
        DungeonEditorSessionValues.OverlaySettings overlaySettings,
        DungeonEditorSessionValues.Selection selection,
        DungeonEditorSessionValues.Preview preview,
        String statusText
) {

    public DungeonEditorSession {
        viewMode = viewMode == null ? DungeonEditorSessionValues.ViewMode.defaultMode() : viewMode;
        selectedTool = selectedTool == null ? DungeonEditorSessionValues.Tool.defaultTool() : selectedTool;
        overlaySettings = overlaySettings == null ? DungeonEditorSessionValues.OverlaySettings.defaults() : overlaySettings;
        selection = selection == null ? DungeonEditorSessionValues.Selection.empty() : selection;
        preview = preview == null ? DungeonEditorSessionValues.Preview.none() : preview;
        statusText = statusText == null ? "" : statusText;
    }

    public static DungeonEditorSession empty() {
        return new DungeonEditorSession(
                null,
                DungeonEditorSessionValues.ViewMode.defaultMode(),
                DungeonEditorSessionValues.Tool.defaultTool(),
                0,
                DungeonEditorSessionValues.OverlaySettings.defaults(),
                DungeonEditorSessionValues.Selection.empty(),
                DungeonEditorSessionValues.Preview.none(),
                "");
    }

    public DungeonEditorSession primeSelectedMap(long mapId) {
        return withSelectedMap(DungeonEditorSessionValues.primeSelectedMap(selectedMapId, mapId));
    }

    public boolean hasSelectedMap() {
        return DungeonEditorSessionValues.hasSelectedMap(selectedMapId);
    }

    public DungeonEditorSession withSelectedMap(@Nullable MapId nextSelectedMapId) {
        return new DungeonEditorSession(
                nextSelectedMapId,
                viewMode,
                selectedTool,
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
                selectedTool,
                projectionLevel,
                overlaySettings,
                selection,
                preview,
                statusText);
    }

    public DungeonEditorSession withSelectedTool(DungeonEditorSessionValues.Tool nextSelectedTool) {
        return new DungeonEditorSession(
                selectedMapId,
                viewMode,
                nextSelectedTool,
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
                selectedTool,
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
                selectedTool,
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
                selectedTool,
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
                selectedTool,
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
                selectedTool,
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
