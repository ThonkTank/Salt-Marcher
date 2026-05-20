package src.domain.dungeon.published;

import java.util.List;
import org.jspecify.annotations.Nullable;

public record DungeonEditorControlsSnapshot(
        List<DungeonMapSummary> maps,
        @Nullable DungeonMapId selectedMapId,
        DungeonEditorViewMode viewMode,
        DungeonEditorTool selectedTool,
        int projectionLevel,
        DungeonOverlaySettings overlaySettings,
        List<Integer> reachableLevels,
        boolean surfaceLoaded,
        String statusText
) {
    public DungeonEditorControlsSnapshot {
        maps = maps == null ? List.of() : List.copyOf(maps);
        viewMode = viewMode == null ? DungeonEditorViewMode.GRID : viewMode;
        selectedTool = selectedTool == null ? DungeonEditorTool.SELECT : selectedTool;
        projectionLevel = Math.max(0, projectionLevel);
        overlaySettings = overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
        reachableLevels = reachableLevels == null ? List.of(0) : List.copyOf(reachableLevels);
        statusText = statusText == null ? "" : statusText;
    }

    public static DungeonEditorControlsSnapshot empty(String statusText) {
        return new DungeonEditorControlsSnapshot(
                List.of(),
                null,
                DungeonEditorViewMode.GRID,
                DungeonEditorTool.SELECT,
                0,
                DungeonOverlaySettings.defaults(),
                List.of(0),
                false,
                statusText);
    }
}
