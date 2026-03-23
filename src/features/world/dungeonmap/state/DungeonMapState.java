package features.world.dungeonmap.state;

import features.world.dungeonmap.loading.DungeonMapCatalogEntry;
import features.world.dungeonmap.model.DungeonLayout;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;

public final class DungeonMapState {

    private final List<Runnable> listeners = new CopyOnWriteArrayList<>();

    private List<DungeonMapCatalogEntry> maps = List.of();
    private DungeonLayout activeMap = DungeonLayout.empty();
    private Long activeMapId;
    private int activeProjectionLevel;
    private boolean loading;
    private String errorMessage;

    public List<DungeonMapCatalogEntry> maps() {
        return maps;
    }

    public DungeonLayout activeMap() {
        return activeMap;
    }

    public Long activeMapId() {
        return activeMapId;
    }

    public int activeProjectionLevel() {
        return activeProjectionLevel;
    }

    public boolean loading() {
        return loading;
    }

    public String errorMessage() {
        return errorMessage;
    }

    public void addListener(Runnable listener) {
        if (listener != null) {
            listeners.add(listener);
        }
    }

    public void removeListener(Runnable listener) {
        listeners.remove(listener);
    }

    public void showLoading() {
        loading = true;
        errorMessage = null;
        notifyListeners();
    }

    public void showLoaded(List<DungeonMapCatalogEntry> maps, DungeonLayout activeMap) {
        Long previousMapId = activeMapId;
        this.maps = maps == null ? List.of() : List.copyOf(maps);
        this.activeMap = activeMap == null ? DungeonLayout.empty() : activeMap;
        this.activeMapId = this.activeMap.mapId() <= 0 ? null : this.activeMap.mapId();
        this.activeProjectionLevel = Objects.equals(previousMapId, this.activeMapId)
                ? activeProjectionLevel
                : defaultProjectionLevel(this.activeMap);
        this.loading = false;
        this.errorMessage = null;
        notifyListeners();
    }

    public void showLoadFailure(List<DungeonMapCatalogEntry> maps, String errorMessage) {
        this.maps = maps == null ? List.of() : List.copyOf(maps);
        this.loading = false;
        this.errorMessage = errorMessage == null || errorMessage.isBlank() ? "Dungeon konnte nicht geladen werden" : errorMessage;
        notifyListeners();
    }

    public void showEditedMap(DungeonLayout activeMap) {
        this.activeMap = activeMap == null ? DungeonLayout.empty() : activeMap;
        this.activeMapId = this.activeMap.mapId() <= 0 ? null : this.activeMap.mapId();
        this.loading = false;
        this.errorMessage = null;
        notifyListeners();
    }

    public void setActiveProjectionLevel(int levelZ) {
        if (activeProjectionLevel == levelZ) {
            return;
        }
        activeProjectionLevel = levelZ;
        notifyListeners();
    }

    public void setReachableProjectionLevel(int levelZ) {
        int resolvedLevel = resolvedProjectionLevel(activeMap, levelZ);
        if (activeProjectionLevel == resolvedLevel) {
            return;
        }
        activeProjectionLevel = resolvedLevel;
        notifyListeners();
    }

    private static int resolvedProjectionLevel(DungeonLayout activeMap, int preferred) {
        if (activeMap == null) {
            return 0;
        }
        return activeMap.reachableLevels().contains(preferred) ? preferred : activeMap.defaultLevel();
    }

    private static int defaultProjectionLevel(DungeonLayout activeMap) {
        return activeMap == null ? 0 : activeMap.defaultLevel();
    }

    private void notifyListeners() {
        for (Runnable listener : listeners) {
            listener.run();
        }
    }
}
