package features.world.dungeonmap.state;

import features.world.dungeonmap.application.runtime.DungeonRuntimeLocation;
import features.world.dungeonmap.application.runtime.DungeonRuntimeNavigationSnapshot;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

public final class DungeonRuntimeState {

    private final List<Runnable> listeners = new CopyOnWriteArrayList<>();

    private DungeonRuntimeLocation activeLocation;
    private List<Long> reachableRoomIds = List.of();
    private boolean loading;
    private boolean moving;
    private String errorMessage;

    public DungeonRuntimeLocation activeLocation() {
        return activeLocation;
    }

    public List<Long> reachableRoomIds() {
        return reachableRoomIds;
    }

    public boolean loading() {
        return loading;
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
        moving = false;
        errorMessage = null;
        notifyListeners();
    }

    public void showMoveInProgress() {
        moving = true;
        errorMessage = null;
        notifyListeners();
    }

    public void showNavigation(DungeonRuntimeNavigationSnapshot snapshot) {
        activeLocation = snapshot == null ? null : snapshot.activeLocation();
        reachableRoomIds = snapshot == null ? List.of() : snapshot.reachableRoomIds();
        loading = false;
        moving = false;
        errorMessage = null;
        notifyListeners();
    }

    public void showFailure(String errorMessage) {
        loading = false;
        moving = false;
        this.errorMessage = errorMessage == null || errorMessage.isBlank()
                ? "Standort konnte nicht geladen werden"
                : errorMessage;
        notifyListeners();
    }

    public void clear() {
        activeLocation = null;
        reachableRoomIds = List.of();
        loading = false;
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
