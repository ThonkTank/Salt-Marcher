package src.features.dungeon.runtime;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorViewMode;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.DungeonOverlaySettings;

sealed interface DungeonEditorAction
        permits DungeonEditorAction.NoOp,
                DungeonEditorAction.SelectTool,
                DungeonEditorAction.SelectViewMode,
                DungeonEditorAction.SelectMap,
                DungeonEditorAction.SetMapSummaries,
                DungeonEditorAction.SetSurfaceLoaded,
                DungeonEditorAction.SetReachableLevels,
                DungeonEditorAction.SetStatusText,
                DungeonEditorAction.SetProjectionLevel,
                DungeonEditorAction.ShiftProjectionLevel,
                DungeonEditorAction.SetOverlay,
                DungeonEditorAction.MarkDraftSessionChanged {

    static NoOp noOp() {
        return NoOp.INSTANCE;
    }

    final class NoOp implements DungeonEditorAction {
        private static final NoOp INSTANCE = new NoOp();

        private NoOp() {
        }
    }

    record SelectTool(DungeonEditorTool tool) implements DungeonEditorAction {
        public SelectTool {
            tool = DungeonEditorStoreState.normalizeSelectedTool(tool);
        }
    }

    record SelectViewMode(DungeonEditorViewMode viewMode) implements DungeonEditorAction {
        public SelectViewMode {
            viewMode = DungeonEditorStoreState.normalizeViewMode(viewMode);
        }
    }

    record SelectMap(@Nullable DungeonMapId mapId) implements DungeonEditorAction {
    }

    record SetMapSummaries(List<DungeonMapSummary> mapSummaries) implements DungeonEditorAction {
        public SetMapSummaries {
            mapSummaries = DungeonEditorStoreState.normalizeMapSummaries(mapSummaries);
        }

        @Override
        public List<DungeonMapSummary> mapSummaries() {
            return List.copyOf(mapSummaries);
        }
    }

    record SetSurfaceLoaded(boolean surfaceLoaded) implements DungeonEditorAction {
    }

    record SetReachableLevels(List<Integer> reachableLevels) implements DungeonEditorAction {
        public SetReachableLevels {
            reachableLevels = DungeonEditorStoreState.normalizeReachableLevels(reachableLevels);
        }

        @Override
        public List<Integer> reachableLevels() {
            return List.copyOf(reachableLevels);
        }
    }

    record SetStatusText(String statusText) implements DungeonEditorAction {
        public SetStatusText {
            statusText = DungeonEditorStoreState.normalizeStatusText(statusText);
        }
    }

    record SetProjectionLevel(int projectionLevel) implements DungeonEditorAction {
    }

    record ShiftProjectionLevel(int levelShift) implements DungeonEditorAction {
    }

    record SetOverlay(DungeonOverlaySettings overlaySettings) implements DungeonEditorAction {
        public SetOverlay {
            overlaySettings = DungeonEditorStoreState.normalizeOverlaySettings(overlaySettings);
        }
    }

    record MarkDraftSessionChanged() implements DungeonEditorAction {
    }
}
