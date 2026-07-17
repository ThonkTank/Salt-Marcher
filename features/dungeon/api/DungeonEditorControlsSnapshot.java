package features.dungeon.api;

import java.util.List;
import org.jspecify.annotations.Nullable;
import features.dungeon.api.editor.DungeonEditorCommandOutcome;
import features.dungeon.api.editor.DungeonEditorToolSelection;

public record DungeonEditorControlsSnapshot(
        List<DungeonMapSummary> maps,
        @Nullable DungeonMapId selectedMapId,
        DungeonEditorViewMode viewMode,
        DungeonEditorToolSelection toolSelection,
        int projectionLevel,
        DungeonOverlaySettings overlaySettings,
        List<Integer> reachableLevels,
        boolean surfaceLoaded,
        String statusText,
        DungeonEditorCommandOutcome commandOutcome
) {
    public DungeonEditorControlsSnapshot {
        maps = maps == null ? List.of() : List.copyOf(maps);
        viewMode = viewMode == null ? DungeonEditorViewMode.GRID : viewMode;
        toolSelection = toolSelection == null ? DungeonEditorToolSelection.select() : toolSelection;
        overlaySettings = overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
        reachableLevels = reachableLevels == null ? List.of(0) : List.copyOf(reachableLevels);
        statusText = statusText == null ? "" : statusText;
        commandOutcome = commandOutcome == null ? DungeonEditorCommandOutcome.idle() : commandOutcome;
    }

    public static DungeonEditorControlsSnapshot empty(String statusText) {
        return new DungeonEditorControlsSnapshot(
                List.of(),
                null,
                DungeonEditorViewMode.GRID,
                DungeonEditorToolSelection.select(),
                0,
                DungeonOverlaySettings.defaults(),
                List.of(0),
                false,
                statusText,
                DungeonEditorCommandOutcome.idle());
    }
}
