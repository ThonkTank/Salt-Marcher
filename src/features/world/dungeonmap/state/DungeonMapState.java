package features.world.dungeonmap.state;

import features.world.dungeonmap.catalog.application.DungeonMapCatalogEntry;
import features.world.dungeonmap.model.DungeonLayout;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Shared map-level session state for the dungeon feature.
 *
 * <p>This state owns the active catalog entry, active layout, projection level, overlay settings, and loading flags.
 * It does not own tool drafts or runtime navigation state.</p>
 */
public final class DungeonMapState {

    private final List<Runnable> listeners = new CopyOnWriteArrayList<>();

    private List<DungeonMapCatalogEntry> maps = List.of();
    private DungeonLayout activeMap = DungeonLayout.empty();
    private Long activeMapId;
    private int activeProjectionLevel;
    private DungeonLevelOverlaySettings levelOverlaySettings = DungeonLevelOverlaySettings.defaults();
    private boolean loading;
    private boolean mutationPending;
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

    public DungeonLevelOverlaySettings levelOverlaySettings() {
        return levelOverlaySettings;
    }

    public boolean loading() {
        return loading;
    }

    public boolean mutationPending() {
        return mutationPending;
    }

    public boolean busy() {
        return loading || mutationPending;
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

    public void showMutationPending() {
        mutationPending = true;
        notifyListeners();
    }

    public void showLoaded(List<DungeonMapCatalogEntry> maps, DungeonLayout activeMap, String errorMessage) {
        Long previousMapId = activeMapId;
        this.maps = maps == null ? List.of() : List.copyOf(maps);
        this.activeMap = activeMap == null ? DungeonLayout.empty() : activeMap;
        this.activeMapId = this.activeMap.mapId() <= 0 ? null : this.activeMap.mapId();
        this.activeProjectionLevel = Objects.equals(previousMapId, this.activeMapId)
                ? activeProjectionLevel
                : defaultProjectionLevel(this.activeMap);
        this.loading = false;
        this.mutationPending = false;
        this.errorMessage = errorMessage == null || errorMessage.isBlank() ? null : errorMessage;
        notifyListeners();
    }

    public void showLoadFailure(List<DungeonMapCatalogEntry> maps, String errorMessage) {
        this.maps = maps == null ? List.of() : List.copyOf(maps);
        this.loading = false;
        this.mutationPending = false;
        this.errorMessage = errorMessage == null || errorMessage.isBlank() ? "Dungeon konnte nicht geladen werden" : errorMessage;
        notifyListeners();
    }

    public void clearMutationPending() {
        if (!mutationPending) {
            return;
        }
        mutationPending = false;
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

    public void setLevelOverlayMode(DungeonLevelOverlayMode mode) {
        updateLevelOverlaySettings(new DungeonLevelOverlaySettings(
                mode,
                levelOverlaySettings.levelRange(),
                levelOverlaySettings.opacity(),
                levelOverlaySettings.selectedLevels()));
    }

    public void setLevelOverlayRange(int levelRange) {
        updateLevelOverlaySettings(new DungeonLevelOverlaySettings(
                levelOverlaySettings.mode(),
                levelRange,
                levelOverlaySettings.opacity(),
                levelOverlaySettings.selectedLevels()));
    }

    public void setLevelOverlayOpacity(double opacity) {
        updateLevelOverlaySettings(new DungeonLevelOverlaySettings(
                levelOverlaySettings.mode(),
                levelOverlaySettings.levelRange(),
                opacity,
                levelOverlaySettings.selectedLevels()));
    }

    public void setSelectedOverlayLevels(List<Integer> levels) {
        updateLevelOverlaySettings(new DungeonLevelOverlaySettings(
                levelOverlaySettings.mode(),
                levelOverlaySettings.levelRange(),
                levelOverlaySettings.opacity(),
                levels));
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

    private void updateLevelOverlaySettings(DungeonLevelOverlaySettings settings) {
        DungeonLevelOverlaySettings resolved = settings == null ? DungeonLevelOverlaySettings.defaults() : settings;
        if (Objects.equals(levelOverlaySettings, resolved)) {
            return;
        }
        levelOverlaySettings = resolved;
        notifyListeners();
    }

    private void notifyListeners() {
        for (Runnable listener : listeners) {
            listener.run();
        }
    }
}
