package src.domain.dungeon.published;

import org.jspecify.annotations.Nullable;

public record DungeonEditorMapSurfaceSnapshot(
        @Nullable DungeonEditorMapProjectionSnapshot mapProjection,
        DungeonEditorViewMode viewMode,
        DungeonOverlaySettings overlaySettings,
        int projectionLevel,
        DungeonEditorTool selectedTool
) {
    public DungeonEditorMapSurfaceSnapshot {
        viewMode = viewMode == null ? DungeonEditorViewMode.GRID : viewMode;
        overlaySettings = overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
        projectionLevel = Math.max(0, projectionLevel);
        selectedTool = selectedTool == null ? DungeonEditorTool.SELECT : selectedTool;
    }

    public static DungeonEditorMapSurfaceSnapshot empty() {
        return new DungeonEditorMapSurfaceSnapshot(
                null,
                DungeonEditorViewMode.GRID,
                DungeonOverlaySettings.defaults(),
                0,
                DungeonEditorTool.SELECT);
    }
}
