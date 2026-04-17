package src.view.dungeonshared.interactor;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.api.BaseMapSnapshot;
import src.domain.dungeon.api.CreateDungeonMapCommand;
import src.domain.dungeon.api.CreateDungeonMapResult;
import src.domain.dungeon.api.DeleteDungeonMapCommand;
import src.domain.dungeon.api.DungeonEditorOperation;
import src.domain.dungeon.api.DungeonInspectorSnapshot;
import src.domain.dungeon.api.DungeonMapId;
import src.domain.dungeon.api.DungeonMapSummary;
import src.domain.dungeon.api.DungeonOperationResult;
import src.domain.dungeon.api.LoadMapSnapshotQuery;
import src.domain.dungeon.api.OnionConfig;
import src.domain.dungeon.api.SearchMapsQuery;
import src.domain.dungeon.api.Viewport;
import src.domain.dungeon.dungeonAPI;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Shared controller for dungeon map selection, loading, creation, deletion, and placeholder edit hooks.
 */
public final class DungeonMapSurfaceController {

    private static final DungeonMapSurfaceController SHARED = new DungeonMapSurfaceController(new dungeonAPI());

    private final dungeonAPI dungeon;
    private final List<Runnable> listeners = new ArrayList<>();

    private String searchText = "";
    private List<DungeonMapSummary> visibleMaps = List.of();
    private @Nullable DungeonMapId selectedMapId;
    private @Nullable DungeonMapId loadedMapId;
    private @Nullable BaseMapSnapshot loadedSnapshot;
    private int currentFloor;
    private DungeonOverlaySettings overlaySettings = DungeonOverlaySettings.defaults();
    private String lastMutationSummary = "Noch keine Editor-Aktion ausgelöst.";
    private List<String> lastMutationMessages = List.of();

    private DungeonMapSurfaceController(dungeonAPI dungeon) {
        this.dungeon = Objects.requireNonNull(dungeon, "dungeon");
    }

    public static DungeonMapSurfaceController shared() {
        return SHARED;
    }

    public void addListener(Runnable listener) {
        listeners.add(Objects.requireNonNull(listener, "listener"));
    }

    public void refreshMaps() {
        visibleMaps = dungeon.searchMaps(new SearchMapsQuery(searchText));
        ensureSelection();
        notifyListeners();
    }

    public List<DungeonMapSummary> visibleMaps() {
        return visibleMaps;
    }

    public List<String> lastMutationMessages() {
        return lastMutationMessages;
    }

    public String lastMutationSummary() {
        return lastMutationSummary;
    }

    public DungeonOverlaySettings overlaySettings() {
        return overlaySettings;
    }

    public int currentFloor() {
        return currentFloor;
    }

    public String searchText() {
        return searchText;
    }

    public void setSearchText(String value) {
        String nextValue = value == null ? "" : value;
        if (searchText.equals(nextValue)) {
            return;
        }
        searchText = nextValue;
        refreshMaps();
    }

    public @Nullable DungeonMapId selectedMapId() {
        return selectedMapId;
    }

    public @Nullable DungeonMapSummary selectedSummary() {
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

    public void selectMap(@Nullable DungeonMapId mapId) {
        if (Objects.equals(selectedMapId, mapId)) {
            return;
        }
        selectedMapId = mapId;
        notifyListeners();
    }

    public boolean canLoadSelected() {
        return selectedSummary() != null;
    }

    public boolean hasLoadedMap() {
        return loadedMapId != null;
    }

    public boolean canApplyEditorOperation() {
        return loadedMapId != null;
    }

    public @Nullable BaseMapSnapshot loadedSnapshot() {
        return loadedSnapshot;
    }

    public DungeonInspectorSnapshot describeSelection(String ownerKind, long ownerId) {
        return dungeon.describeSelection(ownerKind, ownerId);
    }

    public void loadSelected(Viewport viewport) {
        DungeonMapSummary selected = selectedSummary();
        if (selected != null) {
            loadMap(selected.mapId(), viewport);
        }
    }

    public void loadMap(DungeonMapId mapId, Viewport viewport) {
        DungeonMapSummary selected = visibleMaps.stream()
                .filter(summary -> summary.mapId().equals(mapId))
                .findFirst()
                .orElse(null);
        dungeon.activateMap(mapId, selected == null ? "Dungeon Map" : selected.mapName());
        BaseMapSnapshot snapshot = dungeon.loadMapSnapshot(new LoadMapSnapshotQuery(
                mapId,
                currentFloor,
                onionConfig(),
                viewport));
        loadedSnapshot = snapshot;
        loadedMapId = snapshot.mapId();
        selectedMapId = snapshot.mapId();
        currentFloor = snapshot.currentFloor();
        visibleMaps = dungeon.searchMaps(new SearchMapsQuery(searchText));
        ensureSelection();
        notifyListeners();
    }

    public void reloadLoaded(Viewport viewport) {
        if (loadedMapId != null) {
            loadMap(loadedMapId, viewport);
        }
    }

    public void createMap(String mapName, Viewport viewport) {
        String resolvedName = mapName == null || mapName.isBlank() ? defaultMapName() : mapName.trim();
        CreateDungeonMapResult result = dungeon.createMap(new CreateDungeonMapCommand(resolvedName));
        lastMutationSummary = "Dungeon angelegt.";
        lastMutationMessages = List.of("Neue Placeholder-Geometrie wurde für " + resolvedName + " vorbereitet.");
        loadMap(result.mapId(), viewport);
    }

    public void deleteLoaded() {
        if (loadedMapId == null) {
            return;
        }
        dungeon.deleteMap(new DeleteDungeonMapCommand(loadedMapId));
        loadedMapId = null;
        loadedSnapshot = null;
        currentFloor = 0;
        lastMutationSummary = "Geladener Dungeon gelöscht.";
        lastMutationMessages = List.of();
        visibleMaps = dungeon.searchMaps(new SearchMapsQuery(searchText));
        ensureSelection();
        notifyListeners();
    }

    public void stepFloor(int delta, Viewport viewport) {
        int nextFloor = Math.max(0, currentFloor + delta);
        if (nextFloor == currentFloor) {
            return;
        }
        currentFloor = nextFloor;
        reloadLoaded(viewport);
    }

    public void updateOverlayMode(DungeonOverlayMode mode, Viewport viewport) {
        overlaySettings = overlaySettings.withMode(mode);
        reloadLoaded(viewport);
    }

    public void updateOverlayRange(int range, Viewport viewport) {
        overlaySettings = overlaySettings.withLevelRange(range);
        reloadLoaded(viewport);
    }

    public void updateOverlayOpacity(double opacity, Viewport viewport) {
        overlaySettings = overlaySettings.withOpacity(opacity);
        reloadLoaded(viewport);
    }

    public void updateSelectedOverlayLevels(List<Integer> selectedLevels, Viewport viewport) {
        overlaySettings = overlaySettings.withSelectedLevels(selectedLevels);
        reloadLoaded(viewport);
    }

    public void applyEditorOperation(DungeonEditorOperation operation, Viewport viewport) {
        if (loadedMapId == null || operation == null) {
            return;
        }
        DungeonOperationResult result = dungeon.applyOperation(operation);
        lastMutationSummary = result.reactionMessages().isEmpty()
                ? "Editor-Aktion ausgeführt."
                : result.reactionMessages().getFirst();
        lastMutationMessages = mergeMessages(result.validationMessages(), result.reactionMessages());
        reloadLoaded(viewport);
    }

    public String defaultMapName() {
        Set<String> names = new HashSet<>();
        for (DungeonMapSummary summary : dungeon.searchMaps(new SearchMapsQuery(""))) {
            names.add(summary.mapName());
        }
        int next = 1;
        while (names.contains("Dungeon Nr." + next)) {
            next++;
        }
        return "Dungeon Nr." + next;
    }

    public String statusText() {
        if (loadedSnapshot == null) {
            return visibleMaps.isEmpty() ? "Keine Dungeons." : "Kein Dungeon geladen.";
        }
        return loadedSnapshot.mapName() + " · Revision " + loadedSnapshot.revision() + " · Ebene z=" + loadedSnapshot.currentFloor();
    }

    private OnionConfig onionConfig() {
        return switch (overlaySettings.mode()) {
            case OFF -> new OnionConfig(0.0, 0);
            case NEARBY -> new OnionConfig(overlaySettings.opacity(), overlaySettings.levelRange());
            case SELECTED -> new OnionConfig(overlaySettings.opacity(), Math.max(overlaySettings.selectedLevels().size(), 1));
        };
    }

    private List<String> mergeMessages(List<String> validationMessages, List<String> reactionMessages) {
        List<String> merged = new ArrayList<>();
        merged.addAll(validationMessages == null ? List.of() : validationMessages);
        merged.addAll(reactionMessages == null ? List.of() : reactionMessages);
        return List.copyOf(merged);
    }

    private void ensureSelection() {
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

    private void notifyListeners() {
        for (Runnable listener : List.copyOf(listeners)) {
            listener.run();
        }
    }
}
