package features.world.dungeonmap.state;

import features.world.dungeonmap.application.runtime.DungeonRuntimeLocation;
import features.world.dungeonmap.application.runtime.DungeonRuntimeNavigationSnapshot;

import java.util.concurrent.CopyOnWriteArrayList;

public final class DungeonRuntimeState {

    private final java.util.List<Runnable> listeners = new CopyOnWriteArrayList<>();

    private DungeonRuntimeLocation persistedLocation;
    private DungeonRuntimeLocation previewLocation;
    private boolean loading;
    private boolean dragging;
    private boolean moving;
    private String errorMessage;

    public DungeonRuntimeLocation activeLocation() {
        return previewLocation == null ? persistedLocation : previewLocation;
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
        previewLocation = null;
        errorMessage = null;
        notifyListeners();
    }

    public void showDragPreview(DungeonRuntimeLocation location) {
        if (location == null) {
            return;
        }
        previewLocation = location;
        dragging = true;
        moving = false;
        errorMessage = null;
        notifyListeners();
    }

    public void clearDragPreview() {
        previewLocation = null;
        dragging = false;
        notifyListeners();
    }

    public void showMoveInProgress() {
        previewLocation = null;
        dragging = false;
        moving = true;
        errorMessage = null;
        notifyListeners();
    }

    public void showNavigation(DungeonRuntimeNavigationSnapshot snapshot) {
        persistedLocation = snapshot == null ? null : snapshot.activeLocation();
        previewLocation = null;
        loading = false;
        dragging = false;
        moving = false;
        errorMessage = null;
        notifyListeners();
    }

    public void showFailure(String errorMessage) {
        loading = false;
        previewLocation = null;
        dragging = false;
        moving = false;
        this.errorMessage = errorMessage == null || errorMessage.isBlank()
                ? "Standort konnte nicht geladen werden"
                : errorMessage;
        notifyListeners();
    }

    public void clear() {
        persistedLocation = null;
        previewLocation = null;
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
