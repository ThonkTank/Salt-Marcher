package features.dungeon.api;

import org.jspecify.annotations.Nullable;
import features.dungeon.api.editor.DungeonEditorToolSelection;

public record DungeonEditorMapSurfaceSnapshot(
        @Nullable DungeonEditorSurface surface,
        DungeonEditorStateSnapshot.Selection selection,
        DungeonEditorPreview preview,
        DungeonEditorViewMode viewMode,
        DungeonOverlaySettings overlaySettings,
        int projectionLevel,
        DungeonEditorToolSelection toolSelection
) {
    public DungeonEditorMapSurfaceSnapshot {
        selection = selection == null ? DungeonEditorStateSnapshot.Selection.empty() : selection;
        preview = preview == null ? DungeonEditorPreview.none() : preview;
        viewMode = viewMode == null ? DungeonEditorViewMode.GRID : viewMode;
        overlaySettings = overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
        toolSelection = toolSelection == null ? DungeonEditorToolSelection.select() : toolSelection;
    }

    public static DungeonEditorMapSurfaceSnapshot empty() {
        return new DungeonEditorMapSurfaceSnapshot(
                null,
                DungeonEditorStateSnapshot.Selection.empty(),
                DungeonEditorPreview.none(),
                DungeonEditorViewMode.GRID,
                DungeonOverlaySettings.defaults(),
                0,
                DungeonEditorToolSelection.select());
    }
}
