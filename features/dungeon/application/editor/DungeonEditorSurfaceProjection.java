package features.dungeon.application.editor;

import features.dungeon.api.*;
import features.dungeon.api.editor.*;
import org.jspecify.annotations.Nullable;

record DungeonEditorSurfaceProjection(@Nullable DungeonEditorSurface surface, features.dungeon.api.editor.DungeonEditorSelection selection,
        DungeonEditorPreview preview, DungeonEditorViewMode viewMode, DungeonOverlaySettings overlaySettings,
        int projectionLevel, DungeonEditorToolSelection toolSelection) {
    DungeonEditorSurfaceProjection {
        selection = selection == null ? features.dungeon.api.editor.DungeonEditorSelection.empty() : selection;
        preview = preview == null ? DungeonEditorPreview.none() : preview;
        viewMode = viewMode == null ? DungeonEditorViewMode.GRID : viewMode;
        overlaySettings = overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
        toolSelection = toolSelection == null ? DungeonEditorToolSelection.select() : toolSelection;
    }
    static DungeonEditorSurfaceProjection empty() {
        return new DungeonEditorSurfaceProjection(null, features.dungeon.api.editor.DungeonEditorSelection.empty(), DungeonEditorPreview.none(),
                DungeonEditorViewMode.GRID, DungeonOverlaySettings.defaults(), 0, DungeonEditorToolSelection.select());
    }
}
