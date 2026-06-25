package src.domain.dungeon.published;

import org.jspecify.annotations.Nullable;

public record DungeonEditorMapSurfaceSnapshot(
        @Nullable DungeonEditorSurface surface,
        DungeonEditorStateSnapshot.Selection selection,
        DungeonEditorPreview preview,
        DungeonEditorViewMode viewMode,
        DungeonOverlaySettings overlaySettings,
        int projectionLevel,
        DungeonEditorTool selectedTool
) {
    public DungeonEditorMapSurfaceSnapshot {
        selection = selection == null ? DungeonEditorStateSnapshot.Selection.empty() : selection;
        preview = preview == null ? DungeonEditorPreview.none() : preview;
        viewMode = viewMode == null ? DungeonEditorViewMode.GRID : viewMode;
        overlaySettings = overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
        selectedTool = selectedTool == null ? DungeonEditorTool.SELECT : selectedTool;
    }

    public static DungeonEditorMapSurfaceSnapshot empty() {
        return new DungeonEditorMapSurfaceSnapshot(
                null,
                DungeonEditorStateSnapshot.Selection.empty(),
                DungeonEditorPreview.none(),
                DungeonEditorViewMode.GRID,
                DungeonOverlaySettings.defaults(),
                0,
                DungeonEditorTool.SELECT);
    }
}
