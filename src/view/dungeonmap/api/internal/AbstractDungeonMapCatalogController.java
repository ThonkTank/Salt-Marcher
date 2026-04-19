package src.view.dungeonmap.api.internal;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.api.BaseMapSnapshot;
import src.domain.dungeon.api.CreateDungeonMapCommand;
import src.domain.dungeon.api.CreateDungeonMapResult;
import src.domain.dungeon.api.DeleteDungeonMapCommand;
import src.domain.dungeon.api.DungeonMapId;
import src.domain.dungeon.api.DungeonMapSummary;
import src.domain.dungeon.api.LoadMapSnapshotQuery;
import src.domain.dungeon.api.SearchMapsQuery;
import src.domain.dungeon.api.Viewport;
import src.domain.dungeon.DungeonApplicationService;
import java.util.HashSet;
import java.util.Set;
abstract class AbstractDungeonMapCatalogController extends AbstractDungeonMapSurfaceController {
    protected AbstractDungeonMapCatalogController(DungeonApplicationService dungeon) {
        super(dungeon);
    }
    void refreshMaps() {
        visibleMaps = dungeon.searchMaps(new SearchMapsQuery(searchText));
        ensureSelection();
        notifyListeners();
    }
    void setSearchText(String value) {
        String nextValue = value == null ? "" : value;
        if (searchText.equals(nextValue)) {
            return;
        }
        searchText = nextValue;
        refreshMaps();
    }
    void selectMap(@Nullable DungeonMapId mapId) {
        if (java.util.Objects.equals(selectedMapId, mapId)) {
            return;
        }
        selectedMapId = mapId;
        notifyListeners();
    }
    void loadSelected(Viewport viewport) {
        DungeonMapSummary selected = selectedSummary();
        if (selected != null) {
            loadMap(selected.mapId(), viewport);
        }
    }
    void loadMap(DungeonMapId mapId, Viewport viewport) {
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
    void reloadLoaded(Viewport viewport) {
        if (loadedMapId != null) {
            loadMap(loadedMapId, viewport);
        }
    }
    void createMap(String mapName, Viewport viewport) {
        String resolvedName = mapName == null || mapName.isBlank() ? defaultMapName() : mapName.trim();
        CreateDungeonMapResult result = dungeon.createMap(new CreateDungeonMapCommand(resolvedName));
        lastMutationSummary = "Dungeon angelegt.";
        lastMutationMessages = java.util.List.of("Neue Placeholder-Geometrie wurde für " + resolvedName + " vorbereitet.");
        loadMap(result.mapId(), viewport);
    }
    void deleteLoaded() {
        if (loadedMapId == null) {
            return;
        }
        dungeon.deleteMap(new DeleteDungeonMapCommand(loadedMapId));
        loadedMapId = null;
        loadedSnapshot = null;
        currentFloor = 0;
        lastMutationSummary = "Geladener Dungeon gelöscht.";
        lastMutationMessages = java.util.List.of();
        visibleMaps = dungeon.searchMaps(new SearchMapsQuery(searchText));
        ensureSelection();
        notifyListeners();
    }
    String defaultMapName() {
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
}
