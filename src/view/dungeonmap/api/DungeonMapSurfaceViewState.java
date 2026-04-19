package src.view.dungeonmap.api;

import java.util.List;
import org.jspecify.annotations.Nullable;

public record DungeonMapSurfaceViewState(
        List<DungeonMapSummaryViewModel> visibleMaps,
        @Nullable DungeonMapSummaryViewModel selectedSummary,
        @Nullable DungeonLoadedMapViewModel loadedMap,
        int currentFloor,
        DungeonOverlaySettings overlaySettings,
        String lastMutationSummary,
        List<String> lastMutationMessages
) {
    public DungeonMapSurfaceViewState {
        visibleMaps = visibleMaps == null ? List.of() : List.copyOf(visibleMaps);
        lastMutationMessages = lastMutationMessages == null ? List.of() : List.copyOf(lastMutationMessages);
    }

    public boolean hasLoadedMap() {
        return loadedMap != null;
    }

    public boolean canLoadSelected() {
        return selectedSummary != null;
    }

    public boolean canApplyEditorOperation() {
        return loadedMap != null;
    }

    public String statusText() {
        if (loadedMap == null) {
            return visibleMaps.isEmpty() ? "Keine Dungeons." : "Kein Dungeon geladen.";
        }
        return loadedMap.mapName() + " · Revision " + loadedMap.revision() + " · Ebene z=" + loadedMap.currentFloor();
    }
}
