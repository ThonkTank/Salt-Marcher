package src.view.dungeonshared.assembly;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.api.BaseMapSnapshot;
import src.domain.dungeon.api.DungeonMapId;
import src.domain.dungeon.api.DungeonMapSummary;
import src.domain.dungeon.api.OnionConfig;
import src.domain.dungeon.DungeonApplicationService;
import src.view.dungeonshared.ViewModel.DungeonMapSurfaceState;
import src.view.dungeonshared.ViewModel.DungeonOverlaySettings;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
abstract class AbstractDungeonMapSurfaceController {
    protected final DungeonApplicationService dungeon;
    protected final List<Runnable> listeners = new ArrayList<>();
    protected String searchText = "";
    protected List<DungeonMapSummary> visibleMaps = List.of();
    protected @Nullable DungeonMapId selectedMapId;
    protected @Nullable DungeonMapId loadedMapId;
    protected @Nullable BaseMapSnapshot loadedSnapshot;
    protected int currentFloor;
    protected DungeonOverlaySettings overlaySettings = DungeonOverlaySettings.defaults();
    protected String lastMutationSummary = "Noch keine Editor-Aktion ausgelöst.";
    protected List<String> lastMutationMessages = List.of();
    protected AbstractDungeonMapSurfaceController(DungeonApplicationService dungeon) {
        this.dungeon = Objects.requireNonNull(dungeon, "dungeon");
    }
    public void addListener(Runnable listener) {
        listeners.add(Objects.requireNonNull(listener, "listener"));
    }
    public DungeonMapSurfaceState state() {
        return new DungeonMapSurfaceState(
                visibleMaps,
                selectedSummary(),
                loadedSnapshot,
                currentFloor,
                overlaySettings,
                lastMutationSummary,
                lastMutationMessages);
    }
    protected @Nullable DungeonMapSummary selectedSummary() {
        if (selectedMapId == null) {
            return null;
        }
        for (DungeonMapSummary summary : visibleMaps) {
            if (summary.mapId().equals(selectedMapId)) {
                return summary;
            }
        }
        return null;
    }
    protected OnionConfig onionConfig() {
        return switch (overlaySettings.mode()) {
            case OFF -> new OnionConfig(0.0, 0);
            case NEARBY -> new OnionConfig(overlaySettings.opacity(), overlaySettings.levelRange());
            case SELECTED -> new OnionConfig(overlaySettings.opacity(), Math.max(overlaySettings.selectedLevels().size(), 1));
        };
    }
    protected List<String> mergeMessages(List<String> validationMessages, List<String> reactionMessages) {
        List<String> merged = new ArrayList<>();
        merged.addAll(validationMessages == null ? List.of() : validationMessages);
        merged.addAll(reactionMessages == null ? List.of() : reactionMessages);
        return List.copyOf(merged);
    }
    protected void ensureSelection() {
        if (selectedMapId != null && selectedSummary() != null) {
            return;
        }
        if (loadedMapId != null) {
            for (DungeonMapSummary summary : visibleMaps) {
                if (summary.mapId().equals(loadedMapId)) {
                    selectedMapId = loadedMapId;
                    return;
                }
            }
        }
        selectedMapId = visibleMaps.isEmpty() ? null : visibleMaps.getFirst().mapId();
    }
    protected void notifyListeners() {
        for (Runnable listener : List.copyOf(listeners)) {
            listener.run();
        }
    }
}
