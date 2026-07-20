package features.dungeon.application.editor;

import features.dungeon.api.*;
import features.dungeon.api.editor.*;
import java.util.List;
import org.jspecify.annotations.Nullable;

record DungeonEditorControlProjection(List<DungeonMapSummary> maps, @Nullable DungeonMapId selectedMapId,
        DungeonEditorViewMode viewMode, DungeonEditorToolSelection toolSelection, int projectionLevel,
        DungeonOverlaySettings overlaySettings, List<Integer> reachableLevels, boolean surfaceLoaded,
        String statusText, DungeonEditorCommandOutcome commandOutcome) {
    DungeonEditorControlProjection {
        maps = maps == null ? List.of() : List.copyOf(maps);
        viewMode = viewMode == null ? DungeonEditorViewMode.GRID : viewMode;
        toolSelection = toolSelection == null ? DungeonEditorToolSelection.select() : toolSelection;
        overlaySettings = overlaySettings == null ? DungeonOverlaySettings.defaults() : overlaySettings;
        reachableLevels = reachableLevels == null ? List.of(0) : List.copyOf(reachableLevels);
        statusText = statusText == null ? "" : statusText;
        commandOutcome = commandOutcome == null ? DungeonEditorCommandOutcome.idle() : commandOutcome;
    }
    static DungeonEditorControlProjection empty(String status) {
        return new DungeonEditorControlProjection(List.of(), null, DungeonEditorViewMode.GRID,
                DungeonEditorToolSelection.select(), 0, DungeonOverlaySettings.defaults(), List.of(0),
                false, status, DungeonEditorCommandOutcome.idle());
    }
}
