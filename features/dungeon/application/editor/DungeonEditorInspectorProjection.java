package features.dungeon.application.editor;

import features.dungeon.api.*;
import features.dungeon.api.editor.*;
import org.jspecify.annotations.Nullable;

record DungeonEditorInspectorProjection(features.dungeon.api.editor.DungeonEditorSelection selection,
        @Nullable DungeonInspectorSnapshot inspector, DungeonEditorPreview preview, String statusText,
        DungeonEditorViewMode viewMode, DungeonEditorToolSelection toolSelection,
        DungeonOverlaySettings overlaySettings, int projectionLevel) {
    DungeonEditorInspectorProjection {
        selection = selection == null ? features.dungeon.api.editor.DungeonEditorSelection.empty() : selection;
        preview = preview == null ? DungeonEditorPreview.none() : preview;
        statusText = statusText == null ? "" : statusText;
        viewMode = viewMode == null ? DungeonEditorViewMode.GRID : viewMode;
        toolSelection = toolSelection == null ? DungeonEditorToolSelection.select() : toolSelection;
        overlaySettings = overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
    }
    static DungeonEditorInspectorProjection empty(String status) {
        return new DungeonEditorInspectorProjection(features.dungeon.api.editor.DungeonEditorSelection.empty(), null, DungeonEditorPreview.none(),
                status, DungeonEditorViewMode.GRID, DungeonEditorToolSelection.select(),
                DungeonOverlaySettings.defaults(), 0);
    }
}
