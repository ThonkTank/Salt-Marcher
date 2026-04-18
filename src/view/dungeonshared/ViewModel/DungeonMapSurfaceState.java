package src.view.dungeonshared.ViewModel;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.api.BaseMapSnapshot;
import src.domain.dungeon.api.DungeonMapSummary;

import java.util.List;

public record DungeonMapSurfaceState(
        List<DungeonMapSummary> visibleMaps,
        @Nullable DungeonMapSummary selectedSummary,
        @Nullable BaseMapSnapshot loadedSnapshot,
        int currentFloor,
        DungeonOverlaySettings overlaySettings,
        String lastMutationSummary,
        List<String> lastMutationMessages
) {

    public boolean hasLoadedMap() {
        return loadedSnapshot != null;
    }

    public boolean canLoadSelected() {
        return selectedSummary != null;
    }

    public boolean canApplyEditorOperation() {
        return loadedSnapshot != null;
    }

    public String statusText() {
        if (loadedSnapshot == null) {
            return visibleMaps.isEmpty() ? "Keine Dungeons." : "Kein Dungeon geladen.";
        }
        return loadedSnapshot.mapName() + " · Revision " + loadedSnapshot.revision() + " · Ebene z=" + loadedSnapshot.currentFloor();
    }
}
