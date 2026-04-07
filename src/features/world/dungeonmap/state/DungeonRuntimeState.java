package features.world.dungeonmap.state;

import features.world.dungeonmap.application.runtime.DungeonRuntimeNavigationSnapshot;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Shared runtime navigation state for the dungeon view.
 *
 * <p>Persisted navigation, drag preview, pending cross-map continuation, and runtime loading/move flags live here so
 * runtime UI and workflows can coordinate without duplicating navigation truth in the view.</p>
 */
public final class DungeonRuntimeState {

    private final List<Runnable> listeners = new CopyOnWriteArrayList<>();

    private DungeonRuntimeNavigationSnapshot persistedNavigation = DungeonRuntimeNavigationSnapshot.empty();
    private DungeonRuntimeNavigationSnapshot previewNavigation;
    private DungeonRuntimeNavigationSnapshot pendingNavigation;
    private boolean loading;
    private boolean dragging;
    private boolean moving;
    private String errorMessage;

    public DungeonRuntimeNavigationSnapshot persistedNavigation() {
        return persistedNavigation;
    }

    public DungeonRuntimeNavigationSnapshot pendingNavigation() {
        return pendingNavigation;
    }

    public DungeonRuntimeNavigationSnapshot activeNavigation() {
        return previewNavigation != null ? previewNavigation : persistedNavigation;
    }

    public boolean loading() {
        return loading;
    }

    public boolean dragging() {
        return dragging;
    }

    public boolean moving() {
        return moving;
    }

    public String errorMessage() {
        return errorMessage;
    }

    public void addListener(Runnable listener) {
        if (listener != null) {
            listeners.add(listener);
        }
    }

    public void showLoading() {
        loading = true;
        dragging = false;
        moving = false;
        previewNavigation = null;
        errorMessage = null;
        notifyListeners();
    }

    public void showDragPreview(DungeonRuntimeNavigationSnapshot snapshot) {
        if (snapshot == null || snapshot.cell() == null) {
            return;
        }
        previewNavigation = snapshot;
        dragging = true;
        moving = false;
        errorMessage = null;
        notifyListeners();
    }

    public void clearDragPreview() {
        previewNavigation = null;
        dragging = false;
        notifyListeners();
    }

    public void showMoveInProgress() {
        previewNavigation = null;
        dragging = false;
        moving = true;
        errorMessage = null;
        notifyListeners();
    }

    public void showPendingNavigation(DungeonRuntimeNavigationSnapshot snapshot) {
        pendingNavigation = snapshot == null ? null : snapshot;
        previewNavigation = null;
        loading = true;
        dragging = false;
        moving = false;
        errorMessage = null;
        notifyListeners();
    }

    public void clearPendingNavigation() {
        if (pendingNavigation == null) {
            return;
        }
        pendingNavigation = null;
        notifyListeners();
    }

    public void showNavigation(DungeonRuntimeNavigationSnapshot snapshot) {
        persistedNavigation = snapshot == null ? DungeonRuntimeNavigationSnapshot.empty() : snapshot;
        previewNavigation = null;
        pendingNavigation = null;
        loading = false;
        dragging = false;
        moving = false;
        errorMessage = null;
        notifyListeners();
    }

    public void showFailure(String errorMessage) {
        loading = false;
        previewNavigation = null;
        pendingNavigation = null;
        dragging = false;
        moving = false;
        this.errorMessage = errorMessage == null || errorMessage.isBlank()
                ? "Standort konnte nicht geladen werden"
                : errorMessage;
        notifyListeners();
    }

    public void clear() {
        persistedNavigation = DungeonRuntimeNavigationSnapshot.empty();
        previewNavigation = null;
        pendingNavigation = null;
        loading = false;
        dragging = false;
        moving = false;
        errorMessage = null;
        notifyListeners();
    }

    private void notifyListeners() {
        for (Runnable listener : listeners) {
            listener.run();
        }
    }
}
